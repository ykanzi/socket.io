import { describe, it, expect, vi, beforeAll } from "vitest";

// Mock AI service
vi.mock("../services/ai", () => ({
  chat: vi.fn().mockResolvedValue({
    message: "Reponse test",
    confidence: "HIGH",
    sources: [],
    red_flag_detected: false,
    red_flag_level: null,
    suggested_actions: [],
    follow_up_questions: [],
  }),
  streamChat: vi.fn().mockResolvedValue({
    message: "Stream test",
    confidence: "MEDIUM",
    sources: [],
    red_flag_detected: false,
    red_flag_level: null,
    suggested_actions: [],
    follow_up_questions: [],
  }),
}));

// Mock socket.io
vi.mock("socket.io", () => ({
  Server: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
  })),
}));

import express from "express";
import chatRouter from "../routes/chat";

const app = express();
app.use(express.json());
app.use("/api/chat", chatRouter);

// Simple test helper
async function request(
  method: "get" | "post",
  url: string,
  body?: unknown
) {
  const { default: supertest } = await import("supertest");
  if (method === "post") {
    return supertest(app).post(url).send(body).set("Content-Type", "application/json");
  }
  return supertest(app).get(url);
}

describe("Routes Chat API", () => {
  it("GET /api/chat/health doit retourner status ok", async () => {
    const res = await request("get", "/api/chat/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.service).toBe("chat");
  });

  it("POST /api/chat doit retourner une reponse IA", async () => {
    const res = await request("post", "/api/chat", {
      message: "Bonjour, j'ai mal a la tete",
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.message).toBe("Reponse test");
  });

  it("POST /api/chat doit rejeter un message vide", async () => {
    const res = await request("post", "/api/chat", {
      message: "",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Requete invalide");
  });

  it("POST /api/chat doit rejeter sans champ message", async () => {
    const res = await request("post", "/api/chat", {});
    expect(res.status).toBe(400);
  });

  it("POST /api/chat doit accepter un historique de conversation", async () => {
    const res = await request("post", "/api/chat", {
      message: "Depuis 2 jours",
      conversationHistory: [
        { role: "user", content: "J'ai mal a la tete" },
        { role: "assistant", content: "Depuis quand ?" },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("POST /api/chat doit accepter un contexte patient", async () => {
    const res = await request("post", "/api/chat", {
      message: "Mes medicaments ont des interactions ?",
      patient: {
        firstName: "Marie",
        age: 81,
        medications: ["Metformine", "Ramipril"],
        allergies: ["Penicilline"],
        seniorMode: true,
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("POST /api/chat doit rejeter un message trop long (> 5000 chars)", async () => {
    const res = await request("post", "/api/chat", {
      message: "a".repeat(5001),
    });
    expect(res.status).toBe(400);
  });
});
