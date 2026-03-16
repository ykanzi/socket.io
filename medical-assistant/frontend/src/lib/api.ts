const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export interface PatientContext {
  firstName?: string;
  age?: number;
  sex?: string;
  medications?: string[];
  allergies?: string[];
  conditions?: string[];
  seniorMode?: boolean;
}

export interface AIResponse {
  message: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  sources: string[];
  red_flag_detected: boolean;
  red_flag_level: "vital" | "psychiatric" | "high" | null;
  suggested_actions: string[];
  follow_up_questions: string[];
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export async function sendMessage(
  message: string,
  conversationHistory: ConversationMessage[],
  patient?: PatientContext
): Promise<AIResponse> {
  const res = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, conversationHistory, patient }),
  });

  if (!res.ok) {
    throw new Error(`Erreur ${res.status}: ${res.statusText}`);
  }

  const json = await res.json();
  return json.data;
}
