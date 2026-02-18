
import { GoogleGenAI, Type } from "@google/genai";
import { AuditLog } from './types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeSecurityLogs = async (logs: AuditLog[]) => {
  try {
    const logSummary = logs.map(l => `[${l.timestamp}] ${l.severity} - ${l.action}: ${l.details}`).join('\n');
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `As a cybersecurity expert, analyze the following HRM system audit logs for suspicious patterns like brute-force attacks, unauthorized IP access, or VPN usage. Return a JSON report.
      
      Logs:
      ${logSummary}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            riskLevel: { type: Type.STRING, description: 'Low, Medium, or High' },
            summary: { type: Type.STRING },
            anomalies: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  timestamp: { type: Type.STRING },
                  description: { type: Type.STRING },
                  threatType: { type: Type.STRING }
                }
              }
            },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ['riskLevel', 'summary', 'anomalies', 'recommendations']
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini Security Analysis Error:", error);
    return null;
  }
};
