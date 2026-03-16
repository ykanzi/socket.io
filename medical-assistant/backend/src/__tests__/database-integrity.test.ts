import { describe, it, expect, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Integrite base de donnees - Patients", () => {
  it("doit contenir 3 patients", async () => {
    const count = await prisma.patient.count();
    expect(count).toBe(3);
  });

  it("Marie Dupont doit avoir le mode senior active", async () => {
    const marie = await prisma.patient.findFirst({
      where: { email: "marie.dupont@test.fr" },
    });
    expect(marie).not.toBeNull();
    expect(marie!.firstName).toBe("Marie");
    expect(marie!.seniorMode).toBe(true);
    expect(marie!.sex).toBe("F");
  });

  it("Thomas Bernard ne doit pas etre en mode senior", async () => {
    const thomas = await prisma.patient.findFirst({
      where: { email: "thomas.bernard@test.fr" },
    });
    expect(thomas).not.toBeNull();
    expect(thomas!.seniorMode).toBe(false);
  });

  it("Henri Moreau doit avoir le mode vocal active", async () => {
    const henri = await prisma.patient.findFirst({
      where: { firstName: "Henri", lastName: "Moreau" },
    });
    expect(henri).not.toBeNull();
    expect(henri!.voiceMode).toBe(true);
    expect(henri!.seniorMode).toBe(true);
    expect(henri!.fontSizePref).toBe(24);
  });
});

describe("Integrite base de donnees - Medicaments", () => {
  it("doit contenir 7 medicaments", async () => {
    const count = await prisma.medication.count();
    expect(count).toBe(7);
  });

  it("chaque medicament doit avoir un DCI et un nom commercial", async () => {
    const meds = await prisma.medication.findMany();
    for (const med of meds) {
      expect(med.dci.length).toBeGreaterThan(0);
      expect(med.brandName.length).toBeGreaterThan(0);
    }
  });

  it("doit contenir 3 interactions medicamenteuses", async () => {
    const count = await prisma.interaction.count();
    expect(count).toBe(3);
  });

  it("ibuprofene + ramipril doit etre une association deconseillee (AD)", async () => {
    const ibuprofene = await prisma.medication.findFirst({
      where: { dci: "Ibuprofene" },
    });
    const ramipril = await prisma.medication.findFirst({
      where: { dci: "Ramipril" },
    });
    expect(ibuprofene).not.toBeNull();
    expect(ramipril).not.toBeNull();

    const interaction = await prisma.interaction.findFirst({
      where: { medAId: ibuprofene!.id, medBId: ramipril!.id },
    });
    expect(interaction).not.toBeNull();
    expect(interaction!.severity).toBe("AD");
  });
});

describe("Integrite base de donnees - Allergies & Conditions", () => {
  it("Marie doit avoir 2 allergies", async () => {
    const marie = await prisma.patient.findFirst({
      where: { email: "marie.dupont@test.fr" },
      include: { allergies: true },
    });
    expect(marie!.allergies).toHaveLength(2);
    const allergens = marie!.allergies.map((a) => a.allergen);
    expect(allergens).toContain("Penicilline");
    expect(allergens).toContain("Arachides");
  });

  it("Marie doit avoir 3 pathologies dont 1 ALD", async () => {
    const marie = await prisma.patient.findFirst({
      where: { email: "marie.dupont@test.fr" },
      include: { conditions: true },
    });
    expect(marie!.conditions).toHaveLength(3);
    const aldConditions = marie!.conditions.filter((c) => c.isAld);
    expect(aldConditions).toHaveLength(1);
    expect(aldConditions[0].name).toBe("Diabete de type 2");
  });

  it("Henri doit avoir 2 pathologies ALD", async () => {
    const henri = await prisma.patient.findFirst({
      where: { firstName: "Henri" },
      include: { conditions: true },
    });
    expect(henri!.conditions).toHaveLength(2);
    expect(henri!.conditions.every((c) => c.isAld)).toBe(true);
  });
});

describe("Integrite base de donnees - Traitements en cours", () => {
  it("Marie doit avoir 3 medicaments actifs", async () => {
    const marie = await prisma.patient.findFirst({
      where: { email: "marie.dupont@test.fr" },
    });
    const meds = await prisma.patientMedication.findMany({
      where: { patientId: marie!.id, isActive: true },
      include: { medication: true },
    });
    expect(meds).toHaveLength(3);
    const names = meds.map((m) => m.medication.dci);
    expect(names).toContain("Metformine");
    expect(names).toContain("Ramipril");
    expect(names).toContain("Levothyroxine");
  });

  it("chaque traitement doit avoir des creneaux horaires", async () => {
    const marie = await prisma.patient.findFirst({
      where: { email: "marie.dupont@test.fr" },
    });
    const meds = await prisma.patientMedication.findMany({
      where: { patientId: marie!.id },
    });
    for (const med of meds) {
      expect(med.timeSlots.length).toBeGreaterThan(0);
    }
  });
});

describe("Integrite base de donnees - Conversations", () => {
  it("doit contenir 3 conversations", async () => {
    const count = await prisma.conversation.count();
    expect(count).toBe(3);
  });

  it("doit contenir 10 messages", async () => {
    const count = await prisma.message.count();
    expect(count).toBe(10);
  });

  it("doit avoir 1 conversation avec red flag", async () => {
    const redFlagConvs = await prisma.conversation.findMany({
      where: { redFlagTriggered: true },
    });
    expect(redFlagConvs).toHaveLength(1);
    expect(redFlagConvs[0].escalated).toBe(true);
  });

  it("le message red flag doit avoir un audit log", async () => {
    const auditLogs = await prisma.auditLog.findMany({
      where: { eventType: "red_flag" },
    });
    expect(auditLogs).toHaveLength(1);
    expect((auditLogs[0].details as Record<string, unknown>)?.level).toBe("vital");
  });

  it("la conversation de Thomas doit etre de type CONSULT_PREP", async () => {
    const thomas = await prisma.patient.findFirst({
      where: { email: "thomas.bernard@test.fr" },
    });
    const conv = await prisma.conversation.findFirst({
      where: { patientId: thomas!.id },
    });
    expect(conv!.type).toBe("CONSULT_PREP");
  });
});

describe("Integrite base de donnees - Resultats labo", () => {
  it("doit contenir 1 rapport avec 10 resultats", async () => {
    const reports = await prisma.labReport.findMany({
      include: { results: true },
    });
    expect(reports).toHaveLength(1);
    expect(reports[0].results).toHaveLength(10);
  });

  it("doit avoir 2 resultats anormaux (HbA1c + glycemie)", async () => {
    const abnormal = await prisma.labResult.findMany({
      where: { status: { in: ["HIGH", "LOW", "CRITICAL"] } },
    });
    expect(abnormal).toHaveLength(2);
    const names = abnormal.map((r) => r.testName);
    expect(names).toContain("Hemoglobine glyquee (HbA1c)");
    expect(names).toContain("Glycemie a jeun");
  });

  it("chaque resultat doit avoir une explication IA", async () => {
    const results = await prisma.labResult.findMany();
    for (const result of results) {
      expect(result.aiExplanation).not.toBeNull();
      expect(result.aiExplanation!.length).toBeGreaterThan(20);
    }
  });

  it("le rapport doit refleter le bon nombre de normaux/anormaux", async () => {
    const report = await prisma.labReport.findFirst();
    expect(report!.nbNormal).toBe(8);
    expect(report!.nbAbnormal).toBe(2);
  });
});

describe("Integrite base de donnees - Wearables & Metriques", () => {
  it("Henri doit avoir un appareil Withings actif", async () => {
    const henri = await prisma.patient.findFirst({
      where: { firstName: "Henri" },
    });
    const devices = await prisma.wearableDevice.findMany({
      where: { patientId: henri!.id, isActive: true },
    });
    expect(devices).toHaveLength(1);
    expect(devices[0].provider).toBe("withings");
    expect(devices[0].deviceModel).toBe("Body Scan 2");
  });

  it("doit avoir 35 metriques de sante (7 jours x 5 types)", async () => {
    const count = await prisma.healthMetric.count();
    expect(count).toBe(35);
  });

  it("doit avoir des metriques de chaque type", async () => {
    const types = await prisma.healthMetric.groupBy({
      by: ["type"],
      _count: true,
    });
    const typeNames = types.map((t) => t.type);
    expect(typeNames).toContain("BLOOD_PRESSURE");
    expect(typeNames).toContain("HEART_RATE");
    expect(typeNames).toContain("SPO2");
    expect(typeNames).toContain("WEIGHT");
    expect(typeNames).toContain("STEPS");
  });
});

describe("Integrite base de donnees - Aidants", () => {
  it("Fatima doit etre aidante principale d'Henri", async () => {
    const fatima = await prisma.caregiver.findFirst({
      where: { email: "fatima.elamrani@test.fr" },
      include: { links: true },
    });
    expect(fatima).not.toBeNull();
    expect(fatima!.links).toHaveLength(1);
    expect(fatima!.links[0].role).toBe("primary");
    expect(fatima!.links[0].isActive).toBe(true);
  });

  it("l'aidante doit avoir toutes les permissions", async () => {
    const link = await prisma.caregiverLink.findFirst({
      include: { caregiver: true },
    });
    const perms = link!.permissions as Record<string, boolean>;
    expect(perms.view_meds).toBe(true);
    expect(perms.view_labo).toBe(true);
    expect(perms.receive_alerts).toBe(true);
    expect(perms.manage_meds).toBe(true);
  });
});

describe("Integrite base de donnees - Alertes", () => {
  it("doit contenir 2 alertes pour Henri", async () => {
    const henri = await prisma.patient.findFirst({
      where: { firstName: "Henri" },
    });
    const alerts = await prisma.alert.findMany({
      where: { patientId: henri!.id },
    });
    expect(alerts).toHaveLength(2);
  });

  it("doit avoir 1 alerte non acquittee", async () => {
    const unack = await prisma.alert.findMany({
      where: { acknowledged: false },
    });
    expect(unack).toHaveLength(1);
    expect(unack[0].type).toBe("ABNORMAL_LABO");
  });
});

describe("Integrite base de donnees - Prescriptions", () => {
  it("Marie doit avoir 1 prescription avec 2 items", async () => {
    const marie = await prisma.patient.findFirst({
      where: { email: "marie.dupont@test.fr" },
    });
    const prescriptions = await prisma.prescription.findMany({
      where: { patientId: marie!.id },
      include: { items: true },
    });
    expect(prescriptions).toHaveLength(1);
    expect(prescriptions[0].items).toHaveLength(2);
    expect(prescriptions[0].isAld).toBe(true);
  });
});

describe("Integrite base de donnees - Rappels & Prises", () => {
  it("doit avoir des rappels pour aujourd'hui", async () => {
    const today = new Date();
    const startOfDay = new Date(today.toISOString().split("T")[0] + "T00:00:00");
    const endOfDay = new Date(today.toISOString().split("T")[0] + "T23:59:59");

    const reminders = await prisma.medReminder.findMany({
      where: {
        scheduledAt: { gte: startOfDay, lte: endOfDay },
      },
    });
    expect(reminders.length).toBeGreaterThanOrEqual(4);
  });

  it("doit avoir 1 prise manquee (ramipril)", async () => {
    const missed = await prisma.medIntake.findMany({
      where: { status: "MISSED" },
    });
    expect(missed).toHaveLength(1);
  });

  it("doit avoir 2 prises confirmees", async () => {
    const taken = await prisma.medIntake.findMany({
      where: { status: "TAKEN" },
    });
    expect(taken).toHaveLength(2);
    expect(taken.every((t) => t.confirmedBy === "patient")).toBe(true);
  });
});
