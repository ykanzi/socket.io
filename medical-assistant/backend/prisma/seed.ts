import { PrismaClient, Sex, InteractionSeverity, ConversationType, MessageRole, Confidence, LabResultStatus, IntakeStatus, ReminderStatus, AlertType, AlertSeverity, MetricType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Nettoyage de la base de donnees...");
  // Delete in order to respect foreign keys
  await prisma.auditLog.deleteMany();
  await prisma.medIntake.deleteMany();
  await prisma.medReminder.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.labResult.deleteMany();
  await prisma.labReport.deleteMany();
  await prisma.prescriptionItem.deleteMany();
  await prisma.prescription.deleteMany();
  await prisma.patientMedication.deleteMany();
  await prisma.interaction.deleteMany();
  await prisma.healthMetric.deleteMany();
  await prisma.wearableDevice.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.caregiverLink.deleteMany();
  await prisma.caregiver.deleteMany();
  await prisma.patientAllergy.deleteMany();
  await prisma.patientCondition.deleteMany();
  await prisma.medication.deleteMany();
  await prisma.patient.deleteMany();

  console.log("Creation des medicaments...");
  const paracetamol = await prisma.medication.create({
    data: {
      cip13: "3400930000001",
      dci: "Paracetamol",
      brandName: "Doliprane 1000mg",
      dosage: "1000mg",
      form: "comprime",
      atcCode: "N02BE01",
      bdpmCis: "61266250",
    },
  });

  const metformine = await prisma.medication.create({
    data: {
      cip13: "3400930000002",
      dci: "Metformine",
      brandName: "Glucophage 850mg",
      dosage: "850mg",
      form: "comprime pellicule",
      atcCode: "A10BA02",
      bdpmCis: "64578231",
    },
  });

  const ramipril = await prisma.medication.create({
    data: {
      cip13: "3400930000003",
      dci: "Ramipril",
      brandName: "Triatec 5mg",
      dosage: "5mg",
      form: "comprime",
      atcCode: "C09AA05",
      bdpmCis: "67234891",
    },
  });

  const atorvastatine = await prisma.medication.create({
    data: {
      cip13: "3400930000004",
      dci: "Atorvastatine",
      brandName: "Tahor 20mg",
      dosage: "20mg",
      form: "comprime pellicule",
      atcCode: "C10AA05",
      bdpmCis: "68912345",
    },
  });

  const levothyroxine = await prisma.medication.create({
    data: {
      cip13: "3400930000005",
      dci: "Levothyroxine",
      brandName: "Levothyrox 75ug",
      dosage: "75 microgrammes",
      form: "comprime secable",
      atcCode: "H03AA01",
      bdpmCis: "69123456",
    },
  });

  const ibuprofene = await prisma.medication.create({
    data: {
      cip13: "3400930000006",
      dci: "Ibuprofene",
      brandName: "Advil 400mg",
      dosage: "400mg",
      form: "comprime enrobe",
      atcCode: "M01AE01",
      bdpmCis: "60456789",
    },
  });

  const omeprazole = await prisma.medication.create({
    data: {
      cip13: "3400930000007",
      dci: "Omeprazole",
      brandName: "Mopral 20mg",
      dosage: "20mg",
      form: "gelule gastro-resistante",
      atcCode: "A02BC01",
      bdpmCis: "61789012",
    },
  });

  console.log("Creation des interactions medicamenteuses...");
  await prisma.interaction.createMany({
    data: [
      {
        medAId: ibuprofene.id,
        medBId: ramipril.id,
        severity: InteractionSeverity.AD,
        description:
          "L'ibuprofene reduit l'effet antihypertenseur du ramipril et augmente le risque d'insuffisance renale aigue.",
        source: "VIDAL",
      },
      {
        medAId: ibuprofene.id,
        medBId: metformine.id,
        severity: InteractionSeverity.PE,
        description:
          "L'ibuprofene peut augmenter l'effet hypoglycemiant de la metformine. Surveillance de la glycemie recommandee.",
        source: "VIDAL",
      },
      {
        medAId: ramipril.id,
        medBId: atorvastatine.id,
        severity: InteractionSeverity.APC,
        description:
          "Association courante et generalement bien toleree. Pas de precaution particuliere.",
        source: "VIDAL",
      },
    ],
  });

  // =============================================
  // PATIENT 1 : Marie Dupont - Senior diabetique
  // =============================================
  console.log("Creation du patient 1 : Marie Dupont (senior)...");
  const marie = await prisma.patient.create({
    data: {
      firstName: "Marie",
      lastName: "Dupont",
      birthDate: new Date("1945-03-15"),
      sex: Sex.F,
      phone: "06 12 34 56 78",
      email: "marie.dupont@test.fr",
      bloodType: "A+",
      weightKg: 68.5,
      heightCm: 162,
      seniorMode: true,
      voiceMode: false,
      fontSizePref: 22,
      passwordHash: "$2b$10$placeholder_hash_marie",
    },
  });

  await prisma.patientAllergy.createMany({
    data: [
      { patientId: marie.id, allergen: "Penicilline", severity: "severe" },
      { patientId: marie.id, allergen: "Arachides", severity: "moderee" },
    ],
  });

  await prisma.patientCondition.createMany({
    data: [
      {
        patientId: marie.id,
        name: "Diabete de type 2",
        icdCode: "E11",
        isAld: true,
        diagnosedAt: new Date("2015-06-20"),
      },
      {
        patientId: marie.id,
        name: "Hypertension arterielle",
        icdCode: "I10",
        isAld: false,
        diagnosedAt: new Date("2018-01-10"),
      },
      {
        patientId: marie.id,
        name: "Hypothyroidie",
        icdCode: "E03.9",
        isAld: false,
        diagnosedAt: new Date("2020-09-05"),
      },
    ],
  });

  const marieMed1 = await prisma.patientMedication.create({
    data: {
      patientId: marie.id,
      medicationId: metformine.id,
      dosage: "850mg",
      frequency: "2 fois par jour",
      timeSlots: ["08:00", "19:00"],
      startDate: new Date("2015-07-01"),
      prescriber: "Dr. Martin",
      isActive: true,
    },
  });

  const marieMed2 = await prisma.patientMedication.create({
    data: {
      patientId: marie.id,
      medicationId: ramipril.id,
      dosage: "5mg",
      frequency: "1 fois par jour",
      timeSlots: ["08:00"],
      startDate: new Date("2018-02-01"),
      prescriber: "Dr. Martin",
      isActive: true,
    },
  });

  const marieMed3 = await prisma.patientMedication.create({
    data: {
      patientId: marie.id,
      medicationId: levothyroxine.id,
      dosage: "75ug",
      frequency: "1 fois par jour a jeun",
      timeSlots: ["07:00"],
      startDate: new Date("2020-10-01"),
      prescriber: "Dr. Leclerc",
      isActive: true,
    },
  });

  // Rappels pour aujourd'hui
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const reminder1 = await prisma.medReminder.create({
    data: {
      patientMedId: marieMed3.id,
      scheduledAt: new Date(`${todayStr}T07:00:00`),
      reminderSent: true,
      status: ReminderStatus.SENT,
    },
  });

  await prisma.medIntake.create({
    data: {
      reminderId: reminder1.id,
      status: IntakeStatus.TAKEN,
      takenAt: new Date(`${todayStr}T07:05:00`),
      confirmedBy: "patient",
    },
  });

  const reminder2 = await prisma.medReminder.create({
    data: {
      patientMedId: marieMed1.id,
      scheduledAt: new Date(`${todayStr}T08:00:00`),
      reminderSent: true,
      status: ReminderStatus.SENT,
    },
  });

  await prisma.medIntake.create({
    data: {
      reminderId: reminder2.id,
      status: IntakeStatus.TAKEN,
      takenAt: new Date(`${todayStr}T08:12:00`),
      confirmedBy: "patient",
    },
  });

  const reminder3 = await prisma.medReminder.create({
    data: {
      patientMedId: marieMed2.id,
      scheduledAt: new Date(`${todayStr}T08:00:00`),
      reminderSent: true,
      status: ReminderStatus.SENT,
    },
  });

  await prisma.medIntake.create({
    data: {
      reminderId: reminder3.id,
      status: IntakeStatus.MISSED,
    },
  });

  const reminder4 = await prisma.medReminder.create({
    data: {
      patientMedId: marieMed1.id,
      scheduledAt: new Date(`${todayStr}T19:00:00`),
      reminderSent: false,
      status: ReminderStatus.PENDING,
    },
  });

  // Conversations de Marie
  console.log("Creation des conversations de Marie...");
  const conv1 = await prisma.conversation.create({
    data: {
      patientId: marie.id,
      type: ConversationType.CHAT,
      startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      summary: "Question sur les effets secondaires de la metformine",
    },
  });

  await prisma.message.createMany({
    data: [
      {
        conversationId: conv1.id,
        role: MessageRole.USER,
        content: "Bonjour, depuis quelques jours j'ai des maux de ventre. Est-ce que ca peut etre a cause de la metformine ?",
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        conversationId: conv1.id,
        role: MessageRole.ASSISTANT,
        content:
          "Bonjour Marie ! Les troubles digestifs (maux de ventre, nausees, diarrhees) font partie des effets secondaires les plus frequents de la metformine, surtout en debut de traitement ou apres une augmentation de dose. Selon la base VIDAL, ces effets touchent environ 10 a 25% des patients. Ils s'attenuent generalement avec le temps. Quelques conseils : prenez votre metformine pendant ou juste apres le repas, et evitez l'alcool. Si les douleurs persistent plus d'une semaine ou s'aggravent, je vous recommande d'en parler a votre medecin, le Dr. Martin. Souhaitez-vous que je vous aide a preparer cette consultation ?",
        confidence: Confidence.HIGH,
        sources: ["VIDAL:metformine", "HAS:2024-diabete-type2"],
        modelUsed: "claude-sonnet-4-6",
        tokensIn: 45,
        tokensOut: 180,
        latencyMs: 2100,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 3000),
      },
      {
        conversationId: conv1.id,
        role: MessageRole.USER,
        content: "D'accord merci. Et est-ce que je peux prendre du Doliprane pour la douleur ?",
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 60000),
      },
      {
        conversationId: conv1.id,
        role: MessageRole.ASSISTANT,
        content:
          "Oui, le paracetamol (Doliprane) peut etre pris pour soulager les douleurs abdominales legeres. Il n'y a pas d'interaction connue avec vos traitements actuels (metformine, ramipril, levothyroxine). Respectez la posologie de 1g maximum par prise, avec au moins 4 heures entre chaque prise, sans depasser 3g par jour. Attention : evitez l'ibuprofene (Advil), car il est deconseille avec votre ramipril. En cas de doute, demandez conseil a votre pharmacien.",
        confidence: Confidence.HIGH,
        sources: ["VIDAL:paracetamol", "VIDAL:interactions"],
        modelUsed: "claude-sonnet-4-6",
        tokensIn: 35,
        tokensOut: 150,
        latencyMs: 1800,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 63000),
      },
    ],
  });

  // Conversation avec red flag
  const conv2 = await prisma.conversation.create({
    data: {
      patientId: marie.id,
      type: ConversationType.CHAT,
      startedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      redFlagTriggered: true,
      escalated: true,
      summary: "Douleur thoracique - urgence declenchee",
    },
  });

  const redFlagMsg = await prisma.message.create({
    data: {
      conversationId: conv2.id,
      role: MessageRole.USER,
      content: "J'ai une douleur dans la poitrine qui ne passe pas depuis 30 minutes, ca serre",
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    },
  });

  const redFlagResponse = await prisma.message.create({
    data: {
      conversationId: conv2.id,
      role: MessageRole.ASSISTANT,
      content:
        "ATTENTION : Les symptomes que vous decrivez (douleur thoracique avec sensation de serrement persistante) peuvent indiquer une situation d'urgence medicale.\n\nAppelez immediatement le 15 (SAMU) ou le 112.\nSi vous ne pouvez pas parler : envoyez un SMS au 114.\n\nEn attendant les secours :\n- Restez calme et asseyez-vous\n- Ne faites aucun effort physique\n- Ne prenez aucun medicament sans avis medical\n- Si possible, ne restez pas seule\n\nJe previens votre contact d'urgence.",
      confidence: Confidence.HIGH,
      redFlag: true,
      redFlagLevel: "vital",
      modelUsed: "claude-sonnet-4-6",
      tokensIn: 30,
      tokensOut: 120,
      latencyMs: 900,
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 1000),
    },
  });

  await prisma.auditLog.create({
    data: {
      messageId: redFlagResponse.id,
      eventType: "red_flag",
      details: {
        level: "vital",
        keywords: ["douleur thoracique", "serre"],
        action: "samu_15_recommended",
        emergency_contact_notified: true,
      },
    },
  });

  // Resultats de laboratoire de Marie
  console.log("Creation des resultats labo de Marie...");
  const labReport = await prisma.labReport.create({
    data: {
      patientId: marie.id,
      labName: "Laboratoire BioParc - Lyon",
      reportDate: new Date("2026-03-01"),
      importMethod: "pdf",
      parsingConfidence: 0.95,
      summary: "Bilan sanguin de routine - diabete et thyroide",
      nbNormal: 8,
      nbAbnormal: 2,
    },
  });

  await prisma.labResult.createMany({
    data: [
      {
        reportId: labReport.id,
        loincCode: "4548-4",
        testName: "Hemoglobine glyquee (HbA1c)",
        value: 7.2,
        unit: "%",
        refMin: 4.0,
        refMax: 6.5,
        status: LabResultStatus.HIGH,
        aiExplanation:
          "Votre taux d'HbA1c est legerement au-dessus de l'objectif habituel (< 7%). Cela reflete la moyenne de votre glycemie sur les 3 derniers mois. Votre medecin evaluera si un ajustement de traitement est necessaire.",
        aiConfidence: 0.9,
      },
      {
        reportId: labReport.id,
        loincCode: "2345-7",
        testName: "Glycemie a jeun",
        value: 1.35,
        unit: "g/L",
        refMin: 0.7,
        refMax: 1.1,
        status: LabResultStatus.HIGH,
        aiExplanation:
          "Votre glycemie a jeun est au-dessus de la normale. Dans le contexte de votre diabete de type 2, votre medecin interpretera ce resultat avec votre HbA1c.",
        aiConfidence: 0.88,
      },
      {
        reportId: labReport.id,
        loincCode: "3094-0",
        testName: "Creatinine",
        value: 78,
        unit: "umol/L",
        refMin: 44,
        refMax: 97,
        status: LabResultStatus.NORMAL,
        aiExplanation: "Votre fonction renale est dans les valeurs normales. C'est un suivi important avec votre traitement par ramipril.",
        aiConfidence: 0.95,
      },
      {
        reportId: labReport.id,
        loincCode: "3097-3",
        testName: "DFG estime (CKD-EPI)",
        value: 72,
        unit: "mL/min/1.73m2",
        refMin: 60,
        refMax: 120,
        status: LabResultStatus.NORMAL,
        aiExplanation: "Votre debit de filtration glomerulaire est normal, signe d'une bonne fonction renale.",
        aiConfidence: 0.95,
      },
      {
        reportId: labReport.id,
        loincCode: "3016-3",
        testName: "TSH",
        value: 2.8,
        unit: "mUI/L",
        refMin: 0.27,
        refMax: 4.2,
        status: LabResultStatus.NORMAL,
        aiExplanation: "Votre TSH est dans la norme, ce qui indique que votre dose de Levothyrox est bien adaptee.",
        aiConfidence: 0.93,
      },
      {
        reportId: labReport.id,
        loincCode: "2093-3",
        testName: "Cholesterol total",
        value: 2.1,
        unit: "g/L",
        refMin: 1.5,
        refMax: 2.0,
        status: LabResultStatus.NORMAL,
        aiExplanation: "Votre cholesterol total est a la limite superieure de la normale.",
        aiConfidence: 0.85,
      },
      {
        reportId: labReport.id,
        loincCode: "2085-9",
        testName: "Cholesterol HDL",
        value: 0.55,
        unit: "g/L",
        refMin: 0.4,
        refMax: 0.6,
        status: LabResultStatus.NORMAL,
        aiExplanation: "Votre 'bon cholesterol' est dans les valeurs normales.",
        aiConfidence: 0.92,
      },
      {
        reportId: labReport.id,
        loincCode: "2089-1",
        testName: "Cholesterol LDL",
        value: 1.3,
        unit: "g/L",
        refMin: 0.7,
        refMax: 1.3,
        status: LabResultStatus.NORMAL,
        aiExplanation: "Votre LDL est a la limite haute de la normale. Chez un patient diabetique, l'objectif est souvent < 1 g/L.",
        aiConfidence: 0.88,
      },
      {
        reportId: labReport.id,
        loincCode: "718-7",
        testName: "Hemoglobine",
        value: 13.2,
        unit: "g/dL",
        refMin: 12.0,
        refMax: 16.0,
        status: LabResultStatus.NORMAL,
        aiExplanation: "Votre taux d'hemoglobine est normal. Pas de signe d'anemie.",
        aiConfidence: 0.96,
      },
      {
        reportId: labReport.id,
        loincCode: "2160-0",
        testName: "Potassium",
        value: 4.5,
        unit: "mmol/L",
        refMin: 3.5,
        refMax: 5.1,
        status: LabResultStatus.NORMAL,
        aiExplanation: "Votre potassium est normal. C'est un suivi important avec votre traitement par ramipril.",
        aiConfidence: 0.95,
      },
    ],
  });

  // =============================================
  // PATIENT 2 : Thomas Bernard - Jeune actif
  // =============================================
  console.log("Creation du patient 2 : Thomas Bernard...");
  const thomas = await prisma.patient.create({
    data: {
      firstName: "Thomas",
      lastName: "Bernard",
      birthDate: new Date("1992-08-22"),
      sex: Sex.M,
      phone: "07 98 76 54 32",
      email: "thomas.bernard@test.fr",
      weightKg: 82,
      heightCm: 178,
      seniorMode: false,
      passwordHash: "$2b$10$placeholder_hash_thomas",
    },
  });

  await prisma.patientAllergy.create({
    data: { patientId: thomas.id, allergen: "Aspirine", severity: "moderee" },
  });

  await prisma.patientMedication.create({
    data: {
      patientId: thomas.id,
      medicationId: omeprazole.id,
      dosage: "20mg",
      frequency: "1 fois par jour",
      timeSlots: ["07:30"],
      startDate: new Date("2026-01-15"),
      prescriber: "Dr. Moreau",
      isActive: true,
    },
  });

  // Conversation de Thomas
  const conv3 = await prisma.conversation.create({
    data: {
      patientId: thomas.id,
      type: ConversationType.CONSULT_PREP,
      startedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      summary: "Preparation consultation gastro-enterologue",
    },
  });

  await prisma.message.createMany({
    data: [
      {
        conversationId: conv3.id,
        role: MessageRole.USER,
        content: "J'ai rendez-vous chez le gastro la semaine prochaine pour mes brulures d'estomac. Tu peux m'aider a preparer ?",
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
      {
        conversationId: conv3.id,
        role: MessageRole.ASSISTANT,
        content:
          "Bien sur ! Je vais t'aider a preparer ta consultation. On va faire ca etape par etape. Premiere question : depuis combien de temps as-tu ces brulures d'estomac ?",
        confidence: Confidence.HIGH,
        sources: [],
        modelUsed: "claude-sonnet-4-6",
        tokensIn: 40,
        tokensOut: 55,
        latencyMs: 1200,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 2000),
      },
      {
        conversationId: conv3.id,
        role: MessageRole.USER,
        content: "Ca fait environ 3 mois. C'est surtout apres les repas et quand je me couche le soir.",
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 120000),
      },
      {
        conversationId: conv3.id,
        role: MessageRole.ASSISTANT,
        content:
          "Note ! Brulures d'estomac depuis 3 mois, principalement post-prandiales et en position allongee. C'est un element important pour ton gastro. Question suivante : est-ce que tu as d'autres symptomes associes ? Par exemple : remontees acides, nausees, difficulte a avaler, perte de poids ?",
        confidence: Confidence.HIGH,
        sources: [],
        modelUsed: "claude-sonnet-4-6",
        tokensIn: 35,
        tokensOut: 70,
        latencyMs: 1500,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 122000),
      },
    ],
  });

  // =============================================
  // PATIENT 3 : Fatima El-Amrani - Aidante
  // =============================================
  console.log("Creation du patient 3 : Fatima (aidante) + patient Henri...");
  const henri = await prisma.patient.create({
    data: {
      firstName: "Henri",
      lastName: "Moreau",
      birthDate: new Date("1938-11-02"),
      sex: Sex.M,
      phone: "01 23 45 67 89",
      weightKg: 75,
      heightCm: 170,
      seniorMode: true,
      voiceMode: true,
      fontSizePref: 24,
      passwordHash: "$2b$10$placeholder_hash_henri",
    },
  });

  await prisma.patientCondition.createMany({
    data: [
      {
        patientId: henri.id,
        name: "Insuffisance cardiaque",
        icdCode: "I50.0",
        isAld: true,
        diagnosedAt: new Date("2019-03-15"),
      },
      {
        patientId: henri.id,
        name: "Fibrillation auriculaire",
        icdCode: "I48",
        isAld: true,
        diagnosedAt: new Date("2019-03-15"),
      },
    ],
  });

  const fatima = await prisma.caregiver.create({
    data: {
      firstName: "Fatima",
      lastName: "El-Amrani",
      phone: "06 55 44 33 22",
      email: "fatima.elamrani@test.fr",
    },
  });

  await prisma.caregiverLink.create({
    data: {
      caregiverId: fatima.id,
      patientId: henri.id,
      role: "primary",
      permissions: {
        view_meds: true,
        view_labo: true,
        view_activity: true,
        receive_alerts: true,
        manage_meds: true,
      },
      consentGivenAt: new Date("2025-01-15"),
      isActive: true,
    },
  });

  // Wearable + metriques pour Henri
  const withingsDevice = await prisma.wearableDevice.create({
    data: {
      patientId: henri.id,
      provider: "withings",
      deviceModel: "Body Scan 2",
      lastSyncAt: new Date(),
      isActive: true,
    },
  });

  // Metriques sur 7 jours
  for (let i = 6; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split("T")[0];

    await prisma.healthMetric.createMany({
      data: [
        {
          deviceId: withingsDevice.id,
          patientId: henri.id,
          type: MetricType.BLOOD_PRESSURE,
          value: 135 + Math.floor(Math.random() * 15),
          valueSecondary: 78 + Math.floor(Math.random() * 10),
          unit: "mmHg",
          measuredAt: new Date(`${dateStr}T08:00:00`),
          isAbnormal: i < 2,
        },
        {
          deviceId: withingsDevice.id,
          patientId: henri.id,
          type: MetricType.HEART_RATE,
          value: 68 + Math.floor(Math.random() * 20),
          unit: "bpm",
          measuredAt: new Date(`${dateStr}T08:00:00`),
        },
        {
          deviceId: withingsDevice.id,
          patientId: henri.id,
          type: MetricType.WEIGHT,
          value: 75 + (Math.random() * 1.5 - 0.5),
          unit: "kg",
          measuredAt: new Date(`${dateStr}T07:30:00`),
        },
        {
          deviceId: withingsDevice.id,
          patientId: henri.id,
          type: MetricType.SPO2,
          value: 94 + Math.floor(Math.random() * 4),
          unit: "%",
          measuredAt: new Date(`${dateStr}T23:00:00`),
          isAbnormal: 94 + Math.floor(Math.random() * 4) < 95,
        },
        {
          deviceId: withingsDevice.id,
          patientId: henri.id,
          type: MetricType.STEPS,
          value: 2000 + Math.floor(Math.random() * 3000),
          unit: "pas",
          measuredAt: new Date(`${dateStr}T22:00:00`),
        },
      ],
    });
  }

  // Alertes pour Henri
  await prisma.alert.createMany({
    data: [
      {
        patientId: henri.id,
        type: AlertType.ABNORMAL_LABO,
        severity: AlertSeverity.WARNING,
        message: "Tension arterielle elevee detectee : 148/88 mmHg",
        sentVia: "push",
        acknowledged: false,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
      {
        patientId: henri.id,
        type: AlertType.MISSED_MED,
        severity: AlertSeverity.INFO,
        message: "Henri n'a pas confirme la prise de son traitement de 19h",
        sentVia: "push",
        acknowledged: true,
        acknowledgedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 3600000),
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
    ],
  });

  // =============================================
  // Prescription pour Marie
  // =============================================
  console.log("Creation d'une prescription pour Marie...");
  const prescription = await prisma.prescription.create({
    data: {
      patientId: marie.id,
      prescriberId: "Dr. Martin - RPPS 10000012345",
      datePrescribed: new Date("2026-02-15"),
      dateEnd: new Date("2026-08-15"),
      status: "active",
      isAld: true,
      items: {
        create: [
          {
            medicationId: metformine.id,
            dosage: "850mg",
            frequency: "2 fois par jour",
            durationDays: 180,
            instructions: "Pendant les repas",
          },
          {
            medicationId: ramipril.id,
            dosage: "5mg",
            frequency: "1 fois par jour le matin",
            durationDays: 180,
            instructions: "",
          },
        ],
      },
    },
  });

  // =============================================
  // RESUME
  // =============================================
  const patientCount = await prisma.patient.count();
  const medCount = await prisma.medication.count();
  const convCount = await prisma.conversation.count();
  const msgCount = await prisma.message.count();
  const labCount = await prisma.labResult.count();
  const metricCount = await prisma.healthMetric.count();
  const alertCount = await prisma.alert.count();

  console.log(`
  =============================================
  SEED TERMINE AVEC SUCCES !
  =============================================
  Patients:        ${patientCount}
  Medicaments:     ${medCount}
  Conversations:   ${convCount}
  Messages:        ${msgCount}
  Resultats labo:  ${labCount}
  Metriques sante: ${metricCount}
  Alertes:         ${alertCount}
  =============================================

  PATIENTS DE TEST :
  1. Marie Dupont (marie.dupont@test.fr)
     - 81 ans, senior mode, diabetique + HTA + hypothyroidie
     - 3 medicaments actifs, resultats labo recents
     - Conversation avec red flag (douleur thoracique)

  2. Thomas Bernard (thomas.bernard@test.fr)
     - 33 ans, brulures d'estomac, omeprazole
     - Preparation consultation gastro

  3. Henri Moreau (pas d'email)
     - 87 ans, senior mode + voice mode
     - Insuffisance cardiaque + FA
     - Withings Body Scan 2 connecte (7 jours de donnees)
     - Aidante : Fatima El-Amrani (fatima.elamrani@test.fr)
  =============================================
  `);
}

main()
  .catch((e) => {
    console.error("ERREUR SEED:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
