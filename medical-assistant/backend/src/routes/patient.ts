import { Router, Request, Response } from "express";
import { z } from "zod";

const router = Router();

const patientProfileSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  birthDate: z.string(),
  sex: z.enum(["M", "F", "autre"]),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  bloodType: z.string().optional(),
  weightKg: z.number().positive().optional(),
  heightCm: z.number().positive().optional(),
  allergies: z.array(z.string()).default([]),
  conditions: z.array(z.string()).default([]),
  medications: z.array(z.string()).default([]),
  seniorMode: z.boolean().default(false),
});

// In-memory store for MVP (replaced by Prisma later)
const patients = new Map<string, z.infer<typeof patientProfileSchema> & { id: string }>();

router.post("/", (req: Request, res: Response) => {
  const parsed = patientProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Profil invalide",
      details: parsed.error.flatten(),
    });
    return;
  }

  const id = crypto.randomUUID();
  const patient = { id, ...parsed.data };
  patients.set(id, patient);

  res.status(201).json({ success: true, data: patient });
});

router.get("/:id", (req: Request, res: Response) => {
  const patient = patients.get(req.params.id);
  if (!patient) {
    res.status(404).json({ error: "Patient non trouve" });
    return;
  }
  res.json({ success: true, data: patient });
});

router.patch("/:id", (req: Request, res: Response) => {
  const existing = patients.get(req.params.id);
  if (!existing) {
    res.status(404).json({ error: "Patient non trouve" });
    return;
  }

  const updated = { ...existing, ...req.body };
  patients.set(req.params.id, updated);
  res.json({ success: true, data: updated });
});

export default router;
