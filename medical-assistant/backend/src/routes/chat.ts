import { Router, Request, Response } from "express";
import { z } from "zod";
import { chat, PatientContext } from "../services/ai";

const router = Router();

const chatRequestSchema = z.object({
  message: z.string().min(1).max(5000),
  conversationId: z.string().uuid().optional(),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .default([]),
  patient: z
    .object({
      firstName: z.string().optional(),
      age: z.number().optional(),
      sex: z.string().optional(),
      medications: z.array(z.string()).optional(),
      allergies: z.array(z.string()).optional(),
      conditions: z.array(z.string()).optional(),
      seniorMode: z.boolean().optional(),
    })
    .optional(),
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const parsed = chatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Requete invalide",
        details: parsed.error.flatten(),
      });
      return;
    }

    const { message, conversationHistory, patient } = parsed.data;

    const aiResponse = await chat(
      message,
      conversationHistory,
      patient as PatientContext | undefined
    );

    res.json({
      success: true,
      data: aiResponse,
    });
  } catch (error) {
    console.error("Erreur chat IA:", error);
    res.status(500).json({
      error: "Erreur interne du serveur",
      message:
        "Une erreur est survenue lors du traitement de votre message. Veuillez reessayer.",
    });
  }
});

router.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "chat" });
});

export default router;
