"use client";

import { useState, useRef, useEffect, FormEvent } from "react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  disabled,
  placeholder = "Decrivez vos symptomes ou posez une question de sante...",
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [message]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setMessage("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        gap: 8,
        padding: 16,
        background: "var(--bg-white)",
        borderTop: "1px solid var(--border)",
      }}
    >
      <textarea
        ref={textareaRef}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        style={{
          flex: 1,
          resize: "none",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "12px 16px",
          fontSize: 16,
          fontFamily: "inherit",
          outline: "none",
          transition: "border-color 0.2s",
        }}
      />
      <button
        type="submit"
        disabled={disabled || !message.trim()}
        style={{
          background:
            disabled || !message.trim()
              ? "var(--border)"
              : "var(--primary)",
          color: "white",
          border: "none",
          borderRadius: 12,
          padding: "12px 24px",
          fontSize: 16,
          fontWeight: 600,
          cursor: disabled || !message.trim() ? "not-allowed" : "pointer",
          transition: "background 0.2s",
          whiteSpace: "nowrap",
        }}
      >
        Envoyer
      </button>
    </form>
  );
}
