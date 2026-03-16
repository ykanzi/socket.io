"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { sendMessage, AIResponse, ConversationMessage } from "@/lib/api";

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  aiData?: AIResponse;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  async function handleSend(text: string) {
    const userMsg: DisplayMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const history: ConversationMessage[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const aiResponse = await sendMessage(text, history);

      const assistantMsg: DisplayMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: aiResponse.message,
        aiData: aiResponse,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      console.error("Erreur:", error);
      const errorMsg: DisplayMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          "Desole, une erreur est survenue. Veuillez reessayer. Si le probleme persiste, consultez un professionnel de sante.",
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        maxWidth: 800,
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-white)",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Link
          href="/"
          style={{
            textDecoration: "none",
            fontSize: 20,
            color: "var(--text)",
          }}
        >
          &larr;
        </Link>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600 }}>Chat Sante</h1>
          <p style={{ fontSize: 12, color: "var(--text-light)" }}>
            Posez vos questions - ne remplace pas un avis medical
          </p>
        </div>
      </header>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 16,
        }}
      >
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>👋</div>
            <h2
              style={{
                fontSize: 20,
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              Bonjour ! Je suis SantIA.
            </h2>
            <p
              style={{
                color: "var(--text-light)",
                maxWidth: 400,
                margin: "0 auto 24px",
              }}
            >
              Je peux vous aider a comprendre des informations de sante,
              vos traitements ou preparer une consultation.
            </p>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                justifyContent: "center",
              }}
            >
              {[
                "J'ai mal a la tete depuis 2 jours",
                "C'est quoi le paracetamol ?",
                "Je veux preparer ma consultation",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleSend(suggestion)}
                  style={{
                    background: "var(--bg-white)",
                    border: "1px solid var(--border)",
                    borderRadius: 20,
                    padding: "8px 16px",
                    fontSize: 14,
                    cursor: "pointer",
                    color: "var(--primary)",
                    transition: "background 0.2s",
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            role={msg.role}
            content={msg.content}
            aiData={msg.aiData}
          />
        ))}

        {isLoading && (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-start",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                background: "var(--bg-white)",
                border: "1px solid var(--border)",
                borderRadius: 16,
                padding: "12px 20px",
                color: "var(--text-light)",
                fontSize: 14,
              }}
            >
              SantIA reflechit...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Disclaimer */}
      <div
        style={{
          padding: "4px 16px",
          textAlign: "center",
          fontSize: 11,
          color: "var(--text-light)",
          background: "var(--bg)",
        }}
      >
        SantIA ne remplace pas un avis medical. En urgence : 15 (SAMU) | 112 |
        3114 (suicide)
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={isLoading} />
    </div>
  );
}
