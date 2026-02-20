# Project: AI-Driven SOC Analyst (Cyber-Auditor)

Date: January 22, 2026
Author: Rostyslav Huba

Stack: New Relic (NerdGraph), Google Gemini AI, Google Apps Script.

1. Project Concept (The Vertical Model)
This solution implements a direct analytics model where Artificial Intelligence acts as an intellectual layer between the monitoring system and the administrator. The primary goal is to eliminate the bureaucratic delays inherent in traditional support systems.
<img width="1408" height="768" alt="2765" src="https://github.com/user-attachments/assets/de11060c-d562-4c2b-8f28-ae665e52a319" />

Comparative Model Analysis

   | Stage | Traditional Model (Support/Jira) | AI-Driven SOC (Current Project) |
   |---|---|---|
   | Data Collection | Infrastructure logs and metrics | Aggregation via New Relic API |
   | Processing | Task/Ticket creation | Direct context transfer to LLM |
   | Analysis | Manual log review by admin | AI Verdict (threat explanation) |
   | Response Time | 30 min to several hours | 1-2 minutes |

2. Architectural Decisions
 Aggregation (Data Aggregator)
The system utilizes New Relic Infrastructure to collect telemetry from workstations.
 * Cost Optimization: Leverages the Free Tier (100 GB/month), allowing for the monitoring of up to 30-40 nodes at zero cost.
 * Filtering: NRQL queries isolate only anomalies: P2P clients, miners, emulators, or critical CPU load.
 Analytics (Agent Analyst)
Gemini AI serves as a first-line analyst. The model does not merely record a process launch but performs a threat assessment:
 * Identification of potential data leaks.
 * Detection of non-target use of corporate resources.
 * Formation of a step-by-step Action Plan for the administrator.
<img width="1408" height="768" alt="2766" src="https://github.com/user-attachments/assets/0097230f-be4c-4163-b5d1-7eff0738cf69" />

3. Implementation Results
 * Autonomy: The system operates continuously without the need for a dispatcher.
 * Reporting Quality: The administrator receives a meaningful executive summary instead of a raw technical log.
 * Scalability: Rules can be quickly adapted to new threat types by modifying the AI prompt.

<img width="1408" height="768" alt="2767" src="https://github.com/user-attachments/assets/60b53508-7602-4131-91d5-f5746ef87268" />

Documentation prepared for a professional SOC developer portfolio.
