/**
 * PROJECT: AI-DRIVEN SOC ANALYST (CYBER-AUDITOR)
 * Версія: 3.0 (Production Release)
 * Автор: Ростислав Губа
 * * ОПИС:
 * Автономний агент для моніторингу інформаційної безпеки.
 * Скрипт агрегує телеметрію з New Relic, проводить аналіз ризиків за допомогою LLM (Gemini)
 * та доставляє структурований звіт для прийняття управлінських рішень.
 */

// --- КОНФІГУРАЦІЯ ---
// УВАГА: Для продакшн-середовища використовуйте Script Properties для зберігання ключів.
const CONFIG = {
  NR_API_KEY: 'YOUR_NEW_RELIC_USER_KEY',       // User API Key (починається з NRAK-)
  NR_ACCOUNT_ID: 'YOUR_ACCOUNT_ID',            // ID вашого акаунту New Relic
  NR_WORKLOAD_GUID: 'YOUR_WORKLOAD_GUID',      // GUID Workload сутності
  GEMINI_API_KEY: 'YOUR_GEMINI_API_KEY',       // Ключ Google AI Studio
  RECIPIENT_EMAIL: 'security_admin@company.com', // Email для отримання звітів
  GEMINI_MODEL: 'gemini-2.5-flash-preview-09-2025'
};

/**
 * Точка входу (Main Execution)
 * Ця функція має запускатися через Time-driven trigger (наприклад, кожні 30 хвилин).
 */
async function mainAudit() {
  console.log(`[${new Date().toISOString()}] Ініціалізація циклу аудиту.`);
  
  try {
    const rawData = fetchNewRelicData();
    
    // Перевірка наявності даних перед витратою квоти ШІ
    if (rawData && Array.isArray(rawData) && rawData.length > 0) {
      console.log(`Статус: Виявлено ${rawData.length} потенційних інцидентів. Початок аналізу.`);
      
      const analysisReport = await getAiAnalysis(rawData);
      sendEmailReport(analysisReport, rawData.length);
      
    } else {
      console.log("Статус: Система стабільна. Критичних аномалій не виявлено.");
    }
  } catch (error) {
    console.error("Критична помилка виконання:", error.message);
    // Тут можна реалізувати логіку сповіщення про збій системи моніторингу
  }
}

/**
 * Агрегація метрик (Data Ingestion)
 * Виконує запит до New Relic NerdGraph API для отримання вибірки процесів.
 */
function fetchNewRelicData() {
  // NRQL: Фільтрація процесів за сигнатурами загроз (P2P, Miners, Emulators) або аномальним CPU
  const query = `
    SELECT entityName, processDisplayName, cpuPercent 
    FROM ProcessSample 
    WHERE (
      processDisplayName ILIKE '%torrent%' 
      OR processDisplayName ILIKE '%nox%' 
      OR processDisplayName ILIKE '%telegram%' 
      OR processDisplayName ILIKE '%miner%'
      OR processDisplayName ILIKE '%xmrig%'
      OR cpuPercent > 50
    ) 
    AND entityGuid IN (SELECT entityGuid FROM EntitySearch WHERE parentEntityGuid = '${CONFIG.NR_WORKLOAD_GUID}')
    SINCE 60 minutes ago
  `;
  
  const payload = {
    query: `{ actor { account(id: ${CONFIG.NR_ACCOUNT_ID}) { nrql(query: "${query.replace(/\n/g, ' ')}") { results } } } }`
  };

  try {
    const response = UrlFetchApp.fetch('https://api.eu.newrelic.com/graphql', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Api-Key': CONFIG.NR_API_KEY },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    
    const json = JSON.parse(response.getContentText());
    
    if (json.errors) {
      throw new Error(`New Relic API Error: ${JSON.stringify(json.errors)}`);
    }
    
    return json.data?.actor?.account?.nrql?.results || [];
  } catch (e) {
    console.error("Помилка підключення до New Relic:", e.message);
    return [];
  }
}

/**
 * Аналітичне ядро (Intelligence Layer)
 * Формує контекстний промпт та обробляє відповідь від LLM.
 */
async function getAiAnalysis(incidents) {
  // Нормалізація даних у текстовий формат для кращого сприйняття моделлю
  const contextData = incidents.map((item, index) => {
    const host = item.entityName || "Unknown Host";
    const process = item.processDisplayName || "Unknown Process";
    const load = item.cpuPercent?.toFixed(1) || "0";
    return `${index + 1}. Хост: ${host} | Процес: ${process} | Навантаження CPU: ${load}%`;
  }).join("\n");

  const systemPrompt = `
    РОЛЬ: Senior Information Security Officer.
    
    ЗАВДАННЯ: 
    Провести аналіз наданих логів активності та сформувати звіт для керівництва.
    
    ВХІДНІ ДАНІ:
    ${contextData}
    
    СТРУКТУРА ЗВІТУ (УКРАЇНСЬКОЮ):
    1. Резюме інциденту (Executive Summary).
    2. Технічний аналіз загроз:
       - Пояснити природу кожного процесу (наприклад: uTorrent -> P2P протокол -> ризик неконтрольованого трафіку).
       - Оцінити вплив на інфраструктуру.
    3. Рівень критичності (Low / Medium / High).
    4. План реагування (Action Items): Чіткі дії для адміністратора (Kill process, Isolate host, Audit user).
    
    СТИЛЬ:
    Діловий, лаконічний, без води.
  `;

  try {
    const payload = {
      contents: [{ parts: [{ text: systemPrompt }] }],
      generationConfig: { 
        temperature: 0.1, // Мінімізація галюцинацій
        maxOutputTokens: 2000 
      }
    };

    const res = UrlFetchApp.fetch(`https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.GEMINI_MODEL}:generateContent?key=${CONFIG.GEMINI_API_KEY}`, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const json = JSON.parse(res.getContentText());
    
    if (!json.candidates || !json.candidates[0]?.content?.parts?.[0]?.text) {
      throw new Error("Відповідь від Gemini API відсутня або некоректна");
    }

    return json.candidates[0].content.parts[0].text;
  } catch (e) {
    console.error("Помилка AI аналізу:", e.message);
    return "Неможливо згенерувати автоматичний звіт. Будь ласка, перевірте сирі дані вручну.";
  }
}

/**
 * Модуль звітності (Reporting Layer)
 * Відправляє HTML-форматований лист.
 */
function sendEmailReport(analysisText, count) {
  const htmlTemplate = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; max-width: 800px; border: 1px solid #ddd; border-radius: 4px;">
      <div style="background-color: #b71c1c; color: white; padding: 15px 20px;">
        <h2 style="margin: 0; font-size: 18px; letter-spacing: 0.5px;">SOC INCIDENT REPORT</h2>
      </div>
      
      <div style="padding: 25px;">
        <div style="margin-bottom: 20px; font-size: 14px; border-bottom: 1px solid #eee; padding-bottom: 15px;">
          <table style="width: 100%;">
            <tr>
              <td style="font-weight: bold; width: 150px;">Дата звіту:</td>
              <td>${new Date().toLocaleString('uk-UA')}</td>
            </tr>
            <tr>
              <td style="font-weight: bold;">Виявлено об'єктів:</td>
              <td style="color: #d32f2f; font-weight: bold;">${count}</td>
            </tr>
            <tr>
              <td style="font-weight: bold;">Джерело даних:</td>
              <td>New Relic Infrastructure Agent</td>
            </tr>
          </table>
        </div>

        <div style="background-color: #f9f9f9; padding: 20px; border-left: 4px solid #d32f2f; line-height: 1.6;">
          ${analysisText.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}
        </div>
      </div>

      <div style="background-color: #f5f5f5; padding: 12px; text-align: center; font-size: 11px; color: #666; border-top: 1px solid #ddd;">
        Generated by Automated Security Audit System | Powered by Gemini AI & New Relic
      </div>
    </div>
  `;
  
  try {
    GmailApp.sendEmail(CONFIG.RECIPIENT_EMAIL, `[SOC ALERT] Security Incident Report (${count})`, "", {
      htmlBody: htmlTemplate
    });
    console.log(`Звіт успішно відправлено: ${CONFIG.RECIPIENT_EMAIL}`);
  } catch (e) {
    console.error("Помилка SMTP/Gmail API:", e.message);
  }
}



