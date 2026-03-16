import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config";
import { MEDICAL_SYSTEM_PROMPT, RED_FLAG_KEYWORDS } from "../prompts/medical";

const anthropic = new Anthropic({
  apiKey: config.anthropicApiKey,
});

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

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

function detectRedFlags(
  message: string
): { detected: boolean; level: "vital" | "psychiatric" | "high" | null } {
  const lower = message.toLowerCase();

  for (const keyword of RED_FLAG_KEYWORDS.vital) {
    if (lower.includes(keyword)) {
      return { detected: true, level: "vital" };
    }
  }
  for (const keyword of RED_FLAG_KEYWORDS.psychiatric) {
    if (lower.includes(keyword)) {
      return { detected: true, level: "psychiatric" };
    }
  }
  for (const keyword of RED_FLAG_KEYWORDS.high) {
    if (lower.includes(keyword)) {
      return { detected: true, level: "high" };
    }
  }

  return { detected: false, level: null };
}

function buildContextPrompt(patient?: PatientContext): string {
  if (!patient) return "";

  const parts: string[] = ["\n\nCONTEXTE PATIENT :"];
  if (patient.firstName) parts.push(`- Prenom : ${patient.firstName}`);
  if (patient.age) parts.push(`- Age : ${patient.age} ans`);
  if (patient.sex) parts.push(`- Sexe : ${patient.sex}`);
  if (patient.medications?.length) {
    parts.push(`- Medicaments en cours : ${patient.medications.join(", ")}`);
  }
  if (patient.allergies?.length) {
    parts.push(`- Allergies : ${patient.allergies.join(", ")}`);
  }
  if (patient.conditions?.length) {
    parts.push(`- Pathologies connues : ${patient.conditions.join(", ")}`);
  }
  if (patient.seniorMode) {
    parts.push(
      "- Mode SENIOR active : reponses plus courtes et simples, une info par message."
    );
  }

  return parts.join("\n");
}

export async function chat(
  userMessage: string,
  conversationHistory: ConversationMessage[],
  patient?: PatientContext
): Promise<AIResponse> {
  const redFlags = detectRedFlags(userMessage);

  const systemPrompt =
    MEDICAL_SYSTEM_PROMPT + buildContextPrompt(patient);

  const messages = [
    ...conversationHistory.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
    { role: "user" as const, content: userMessage },
  ];

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  });

  const rawText =
    response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const parsed = JSON.parse(rawText) as AIResponse;
    if (redFlags.detected) {
      parsed.red_flag_detected = true;
      parsed.red_flag_level = redFlags.level;
    }
    return parsed;
  } catch {
    return {
      message: rawText,
      confidence: "MEDIUM",
      sources: [],
      red_flag_detected: redFlags.detected,
      red_flag_level: redFlags.level,
      suggested_actions: [],
      follow_up_questions: [],
    };
  }
}

export async function streamChat(
  userMessage: string,
  conversationHistory: ConversationMessage[],
  patient?: PatientContext,
  onChunk?: (text: string) => void
): Promise<AIResponse> {
  const redFlags = detectRedFlags(userMessage);
  const systemPrompt =
    MEDICAL_SYSTEM_PROMPT + buildContextPrompt(patient);

  const messages = [
    ...conversationHistory.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
    { role: "user" as const, content: userMessage },
  ];

  let fullText = "";

  const stream = anthropic.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      fullText += event.delta.text;
      onChunk?.(event.delta.text);
    }
  }

  try {
    const parsed = JSON.parse(fullText) as AIResponse;
    if (redFlags.detected) {
      parsed.red_flag_detected = true;
      parsed.red_flag_level = redFlags.level;
    }
    return parsed;
  } catch {
    return {
      message: fullText,
      confidence: "MEDIUM",
      sources: [],
      red_flag_detected: redFlags.detected,
      red_flag_level: redFlags.level,
      suggested_actions: [],
      follow_up_questions: [],
    };
  }
}
