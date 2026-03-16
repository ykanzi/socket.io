import { describe, it, expect } from "vitest";
import {
  MEDICAL_SYSTEM_PROMPT,
  RED_FLAG_KEYWORDS,
} from "../prompts/medical";

describe("System Prompt Medical", () => {
  it("doit contenir l'identite SantIA", () => {
    expect(MEDICAL_SYSTEM_PROMPT).toContain("SantIA");
  });

  it("doit contenir les regles absolues", () => {
    expect(MEDICAL_SYSTEM_PROMPT).toContain("REGLES ABSOLUES");
    expect(MEDICAL_SYSTEM_PROMPT).toContain("JAMAIS de diagnostic");
    expect(MEDICAL_SYSTEM_PROMPT).toContain("JAMAIS de traitement");
  });

  it("doit contenir les numeros d'urgence", () => {
    expect(MEDICAL_SYSTEM_PROMPT).toContain("15");
    expect(MEDICAL_SYSTEM_PROMPT).toContain("112");
    expect(MEDICAL_SYSTEM_PROMPT).toContain("114");
    expect(MEDICAL_SYSTEM_PROMPT).toContain("3114");
  });

  it("doit contenir les instructions de detection red flags", () => {
    expect(MEDICAL_SYSTEM_PROMPT).toContain("DETECTION RED FLAGS");
    expect(MEDICAL_SYSTEM_PROMPT).toContain("URGENCE VITALE");
    expect(MEDICAL_SYSTEM_PROMPT).toContain("URGENCE PSYCHIATRIQUE");
  });

  it("doit exiger le format JSON en sortie", () => {
    expect(MEDICAL_SYSTEM_PROMPT).toContain("FORMAT DE REPONSE");
    expect(MEDICAL_SYSTEM_PROMPT).toContain('"message"');
    expect(MEDICAL_SYSTEM_PROMPT).toContain('"confidence"');
    expect(MEDICAL_SYSTEM_PROMPT).toContain('"red_flag_detected"');
    expect(MEDICAL_SYSTEM_PROMPT).toContain('"sources"');
  });

  it("doit contenir les instructions d'adaptation senior", () => {
    expect(MEDICAL_SYSTEM_PROMPT).toContain("ADAPTATION SENIOR");
  });

  it("doit contenir les instructions de tonalite", () => {
    expect(MEDICAL_SYSTEM_PROMPT).toContain("Vouvoiement par defaut");
    expect(MEDICAL_SYSTEM_PROMPT).toContain("francais simple et clair");
  });

  it("ne doit pas contenir de placeholder non rempli", () => {
    expect(MEDICAL_SYSTEM_PROMPT).not.toContain("[NOM_APP]");
  });
});

describe("Red Flag Keywords", () => {
  it("doit avoir des mots-cles vitaux", () => {
    expect(RED_FLAG_KEYWORDS.vital.length).toBeGreaterThan(5);
    expect(RED_FLAG_KEYWORDS.vital).toContain("douleur thoracique");
    expect(RED_FLAG_KEYWORDS.vital).toContain("etouffement");
    expect(RED_FLAG_KEYWORDS.vital).toContain("hemorragie");
    expect(RED_FLAG_KEYWORDS.vital).toContain("convulsion");
    expect(RED_FLAG_KEYWORDS.vital).toContain("surdosage");
  });

  it("doit avoir des mots-cles psychiatriques", () => {
    expect(RED_FLAG_KEYWORDS.psychiatric.length).toBeGreaterThan(3);
    expect(RED_FLAG_KEYWORDS.psychiatric).toContain("suicide");
    expect(RED_FLAG_KEYWORDS.psychiatric).toContain("suicidaire");
    expect(RED_FLAG_KEYWORDS.psychiatric).toContain("automutilation");
  });

  it("doit avoir des mots-cles d'alerte haute", () => {
    expect(RED_FLAG_KEYWORDS.high.length).toBeGreaterThan(3);
    expect(RED_FLAG_KEYWORDS.high).toContain("douleur intense");
    expect(RED_FLAG_KEYWORDS.high).toContain("confusion");
  });

  it("ne doit pas avoir de doublons dans chaque categorie", () => {
    const checkDuplicates = (arr: string[]) =>
      new Set(arr).size === arr.length;
    expect(checkDuplicates(RED_FLAG_KEYWORDS.vital)).toBe(true);
    expect(checkDuplicates(RED_FLAG_KEYWORDS.psychiatric)).toBe(true);
    expect(checkDuplicates(RED_FLAG_KEYWORDS.high)).toBe(true);
  });
});
