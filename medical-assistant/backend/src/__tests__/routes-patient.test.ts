import { describe, it, expect, vi } from "vitest";
import express from "express";
import patientRouter from "../routes/patient";

// Mock socket.io
vi.mock("socket.io", () => ({
  Server: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
  })),
}));

const app = express();
app.use(express.json());
app.use("/api/patients", patientRouter);

async function request(
  method: "get" | "post" | "patch",
  url: string,
  body?: unknown
) {
  const { default: supertest } = await import("supertest");
  const req = supertest(app)[method](url);
  if (body) {
    return req.send(body).set("Content-Type", "application/json");
  }
  return req;
}

describe("Routes Patient API", () => {
  let patientId: string;

  const validPatient = {
    firstName: "Test",
    lastName: "Patient",
    birthDate: "1990-05-15T00:00:00.000Z",
    sex: "F",
    phone: "06 11 22 33 44",
    email: "test.patient@test.fr",
    allergies: ["Penicilline"],
    conditions: ["Asthme"],
    medications: [],
  };

  it("POST /api/patients doit creer un patient", async () => {
    const res = await request("post", "/api/patients", validPatient);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.firstName).toBe("Test");
    expect(res.body.data.lastName).toBe("Patient");
    patientId = res.body.data.id;
  });

  it("GET /api/patients/:id doit retourner le patient", async () => {
    const res = await request("get", `/api/patients/${patientId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.firstName).toBe("Test");
    expect(res.body.data.allergies).toContain("Penicilline");
  });

  it("GET /api/patients/:id doit retourner 404 pour un id inconnu", async () => {
    const res = await request(
      "get",
      "/api/patients/00000000-0000-0000-0000-000000000000"
    );
    expect(res.status).toBe(404);
  });

  it("PATCH /api/patients/:id doit mettre a jour le patient", async () => {
    const res = await request("patch", `/api/patients/${patientId}`, {
      weightKg: 65,
      seniorMode: true,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.weightKg).toBe(65);
    expect(res.body.data.seniorMode).toBe(true);
  });

  it("POST /api/patients doit rejeter sans prenom", async () => {
    const res = await request("post", "/api/patients", {
      lastName: "Test",
      birthDate: "1990-01-01",
      sex: "M",
    });
    expect(res.status).toBe(400);
  });

  it("POST /api/patients doit rejeter un sexe invalide", async () => {
    const res = await request("post", "/api/patients", {
      firstName: "Test",
      lastName: "Test",
      birthDate: "1990-01-01",
      sex: "X",
    });
    expect(res.status).toBe(400);
  });

  it("POST /api/patients doit rejeter un email invalide", async () => {
    const res = await request("post", "/api/patients", {
      firstName: "Test",
      lastName: "Test",
      birthDate: "1990-01-01",
      sex: "M",
      email: "pas-un-email",
    });
    expect(res.status).toBe(400);
  });
});
