"use client";

import { AIResponse } from "@/lib/api";
import { EmergencyBanner } from "./EmergencyBanner";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  aiData?: AIResponse;
  isStreaming?: boolean;
}

export function ChatMessage({
  role,
  content,
  aiData,
  isStreaming,
}: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div
      className="chat-message"
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        marginBottom: 16,
      }}
    >
      <div
        style={{
          maxWidth: "80%",
          padding: "12px 16px",
          borderRadius: 16,
          background: isUser ? "var(--primary)" : "var(--bg-white)",
          color: isUser ? "white" : "var(--text)",
          border: isUser ? "none" : "1px solid var(--border)",
          boxShadow: "var(--shadow)",
        }}
      >
        {!isUser && aiData?.red_flag_detected && aiData.red_flag_level && (
          <EmergencyBanner level={aiData.red_flag_level} />
        )}

        <p style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {content}
          {isStreaming && (
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 16,
                background: "var(--primary)",
                marginLeft: 2,
                animation: "blink 1s infinite",
              }}
            />
          )}
        </p>

        {!isUser && aiData && !isStreaming && (
          <div style={{ marginTop: 12 }}>
            {aiData.sources.length > 0 && (
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-light)",
                  marginBottom: 8,
                }}
              >
                Sources : {aiData.sources.join(", ")}
              </div>
            )}

            {aiData.confidence && (
              <span
                style={{
                  fontSize: 11,
                  padding: "2px 8px",
                  borderRadius: 4,
                  background:
                    aiData.confidence === "HIGH"
                      ? "#dcfce7"
                      : aiData.confidence === "MEDIUM"
                        ? "#fef9c3"
                        : "#fee2e2",
                  color:
                    aiData.confidence === "HIGH"
                      ? "#166534"
                      : aiData.confidence === "MEDIUM"
                        ? "#854d0e"
                        : "#991b1b",
                }}
              >
                Confiance : {aiData.confidence}
              </span>
            )}

            {aiData.follow_up_questions.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {aiData.follow_up_questions.map((q, i) => (
                  <button
                    key={i}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      padding: "8px 12px",
                      marginTop: 4,
                      cursor: "pointer",
                      fontSize: 13,
                      color: "var(--primary)",
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
