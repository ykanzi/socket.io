import { describe, it, expect, vi } from "vitest";

// Mock Anthropic SDK before importing the service
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                message:
                  "Le paracetamol est un medicament antalgique et antipyretique.",
                confidence: "HIGH",
                sources: ["VIDAL:paracetamol"],
                red_flag_detected: false,
                red_flag_level: null,
                suggested_actions: [],
                follow_up_questions: [
                  "Avez-vous des allergies connues ?",
                ],
              }),
            },
          ],
        }),
        stream: vi.fn().mockReturnValue({
          [Symbol.asyncIterator]: async function* () {
            yield {
              type: "content_block_delta",
              delta: { type: "text_delta", text: '{"message":"Test"}' },
            };
          },
        }),
      },
    })),
  };
});

// Import after mock
const { chat, streamChat } = await import("../services/ai");

describe("Service AI - chat()", () => {
  it("doit retourner une reponse structuree", async () => {
    const response = await chat("C'est quoi le paracetamol ?", []);

    expect(response).toBeDefined();
    expect(response.message).toBeDefined();
    expect(response.message.length).toBeGreaterThan(0);
    expect(response.confidence).toBe("HIGH");
    expect(response.sources).toContain("VIDAL:paracetamol");
    expect(response.red_flag_detected).toBe(false);
  });

  it("doit detecter un red flag vital dans le message utilisateur", async () => {
    const response = await chat(
      "J'ai une douleur thoracique intense",
      []
    );

    expect(response.red_flag_detected).toBe(true);
    expect(response.red_flag_level).toBe("vital");
  });

  it("doit detecter un red flag psychiatrique", async () => {
    const response = await chat("Je pense au suicide", []);

    expect(response.red_flag_detected).toBe(true);
    expect(response.red_flag_level).toBe("psychiatric");
  });

  it("doit detecter un red flag haute alerte", async () => {
    const response = await chat("J'ai une douleur intense depuis 3 jours", []);

    expect(response.red_flag_detected).toBe(true);
    expect(response.red_flag_level).toBe("high");
  });

  it("ne doit pas detecter de red flag pour une question banale", async () => {
    const response = await chat(
      "Combien de fois par jour prendre du Doliprane ?",
      []
    );

    expect(response.red_flag_detected).toBe(false);
    expect(response.red_flag_level).toBeNull();
  });

  it("doit accepter un contexte patient", async () => {
    const response = await chat("J'ai mal a la tete", [], {
      firstName: "Marie",
      age: 81,
      sex: "F",
      medications: ["Metformine 850mg", "Ramipril 5mg"],
      allergies: ["Penicilline"],
      seniorMode: true,
    });

    expect(response).toBeDefined();
    expect(response.message.length).toBeGreaterThan(0);
  });

  it("doit gerer l'historique de conversation", async () => {
    const history = [
      { role: "user" as const, content: "J'ai mal a la tete" },
      {
        role: "assistant" as const,
        content: "Depuis combien de temps avez-vous mal ?",
      },
    ];

    const response = await chat("Depuis hier soir", history);
    expect(response).toBeDefined();
  });
});

describe("Service AI - streamChat()", () => {
  it("doit streamer des chunks", async () => {
    const chunks: string[] = [];
    const response = await streamChat("Test", [], undefined, (chunk) => {
      chunks.push(chunk);
    });

    expect(response).toBeDefined();
  });
});
