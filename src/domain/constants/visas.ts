// src/domain/constants/visas.ts
export type VisaCode = string;

export const VISA_META: Record<string, { label: string; short?: string; group?: string }> = {
  // —————————————————————————————————————————————————
  // DIPLOMÁTICOS / ORGANIZAÇÕES INTERNACIONAIS / NATO
  // —————————————————————————————————————————————————
  A1: { label: "A-1 (Diplomata/Chefe de Estado)", group: "Diplomático" },
  A2: { label: "A-2 (Outros funcionários governamentais)", group: "Diplomático" },
  A3: { label: "A-3 (Empregado de A-1/A-2)", group: "Diplomático" },

  G1: { label: "G-1 (Missão de organização internacional)", group: "Organizações Internacionais" },
  G2: { label: "G-2 (Representantes)", group: "Organizações Internacionais" },
  G3: { label: "G-3 (Representantes de países não membros)", group: "Organizações Internacionais" },
  G4: { label: "G-4 (Funcionários de OIs)", group: "Organizações Internacionais" },
  G5: { label: "G-5 (Empregado de G-1..G-4)", group: "Organizações Internacionais" },

  NATO1: { label: "NATO-1", group: "NATO" },
  NATO2: { label: "NATO-2", group: "NATO" },
  NATO3: { label: "NATO-3", group: "NATO" },
  NATO4: { label: "NATO-4", group: "NATO" },
  NATO5: { label: "NATO-5", group: "NATO" },
  NATO6: { label: "NATO-6", group: "NATO" },
  NATO7: { label: "NATO-7 (Empregados domésticos de NATO)", group: "NATO" },

  // —————————————————————————————————————————————————
  // VISITA / NEGÓCIOS / TRÂNSITO / TRIPULANTES / VWP
  // —————————————————————————————————————————————————
  B1: { label: "B-1 (Business Visitor)", group: "Visita" },
  B2: { label: "B-2 (Tourist Visitor)", group: "Visita" },
  B1_B2: { label: "B-1/B-2 (Negócios/Turismo)", group: "Visita" },

  C:  { label: "C (Trânsito)", group: "Trânsito" },
  C1:{ label: "C-1 (Trânsito), inclusive C-1/D p/ tripulante", group: "Trânsito" },
  C2:{ label: "C-2 (Trânsito ONU)", group: "Trânsito" },
  C3:{ label: "C-3 (Trânsito — oficiais estrangeiros)", group: "Trânsito" },

  D:   { label: "D (Tripulante marítimo/aéreo)", group: "Tripulantes" },
  C1D: { label: "C-1/D (Trânsito + Tripulante)", group: "Tripulantes" },

  // Visa Waiver Program (não é “visto”, mas classe de admissão)
  WB:  { label: "WB (Visa Waiver — Business)", group: "VWP" },
  WT:  { label: "WT (Visa Waiver — Tourism)", group: "VWP" },

  // —————————————————————————————————————————————————
  // ESTUDO / INTERCÂMBIO
  // —————————————————————————————————————————————————
  F1: { label: "F-1 (Estudante acadêmico)", group: "Estudo" },
  F2: { label: "F-2 (Dependente de F-1)", group: "Estudo" },

  M1: { label: "M-1 (Estudante vocacional)", group: "Estudo" },
  M2: { label: "M-2 (Dependente de M-1)", group: "Estudo" },

  J1: { label: "J-1 (Exchange Visitor)", group: "Intercâmbio" },
  J2: { label: "J-2 (Dependente de J-1)", group: "Intercâmbio" },

  // —————————————————————————————————————————————————
  // TRABALHO / PROFISSIONAL
  // —————————————————————————————————————————————————
  H1B:  { label: "H-1B (Specialty Occupation)", group: "Trabalho" },
  H1B1: { label: "H-1B1 (Chile/Singapura)", group: "Trabalho" },
  H2A:  { label: "H-2A (Agrícola sazonal)", group: "Trabalho" },
  H2B:  { label: "H-2B (Não-agrícola sazonal)", group: "Trabalho" },
  H3:   { label: "H-3 (Trainee)", group: "Trabalho" },

  L1: { label: "L-1 (Intracompany Transfer)", group: "Trabalho" },
  L2: { label: "L-2 (Dependente de L-1)", group: "Trabalho" },

  O1:  { label: "O-1 (Extraordinary Ability)", group: "Trabalho/Artes/Ciência" },
  O1A: { label: "O-1A (Ciência/Negócios/Esportes)", group: "Trabalho/Artes/Ciência" },
  O1B: { label: "O-1B (Artes/Filme/TV)", group: "Trabalho/Artes/Ciência" },
  O2:  { label: "O-2 (Assistente de O-1)", group: "Trabalho/Artes/Ciência" },
  O3:  { label: "O-3 (Dependente de O-1/O-2)", group: "Trabalho/Artes/Ciência" },

  P1: { label: "P-1 (Atletas/equipes reconhecidos)", group: "Trabalho/Artes" },
  P2: { label: "P-2 (Artistas em programa de intercâmbio)", group: "Trabalho/Artes" },
  P3: { label: "P-3 (Artistas/apresentações culturais)", group: "Trabalho/Artes" },
  P4: { label: "P-4 (Dependente de P-1/2/3)", group: "Trabalho/Artes" },

  Q1: { label: "Q-1 (Intercâmbio cultural)", group: "Intercâmbio" },

  R1: { label: "R-1 (Trabalhador religioso)", group: "Trabalho" },
  R2: { label: "R-2 (Dependente de R-1)", group: "Trabalho" },

  I:  { label: "I (Imprensa/Media)", group: "Imprensa" },

  E1: { label: "E-1 (Treaty Trader)", group: "Tratados (E)" },
  E2: { label: "E-2 (Treaty Investor)", group: "Tratados (E)" },
  E3: { label: "E-3 (Austrália — Specialty Occupation)", group: "Tratados (E)" },

  TN: { label: "TN (Profissional — USMCA/NAFTA)", group: "Trabalho" },
  TD: { label: "TD (Dependente de TN)", group: "Trabalho" },

  // CNMI (Marianas do Norte) — ainda aparecem ocasionalmente
  CW1: { label: "CW-1 (CNMI Transitional Worker)", group: "Trabalho" },
  CW2: { label: "CW-2 (Dependente de CW-1)", group: "Trabalho" },

  // —————————————————————————————————————————————————
  // FAMÍLIA / NOIVADO (não-imigrante de ponte)
  // —————————————————————————————————————————————————
  K1: { label: "K-1 (Noivo(a) de cidadão)", group: "Família/Noivado" },
  K2: { label: "K-2 (Filho de K-1)", group: "Família/Noivado" },
  K3: { label: "K-3 (Cônjuge de cidadão — ponte)", group: "Família/Noivado" },
  K4: { label: "K-4 (Filho de K-3)", group: "Família/Noivado" },

  // —————————————————————————————————————————————————
  // HUMANITÁRIOS / ESPECIAIS (não-imigrantes)
  // —————————————————————————————————————————————————
  T1: { label: "T-1 (Vítima de tráfico — principal)", group: "Humanitário" },
  T2: { label: "T-2 (Cônjuge de T-1)", group: "Humanitário" },
  T3: { label: "T-3 (Filho de T-1)", group: "Humanitário" },
  T4: { label: "T-4 (Pai de T-1)", group: "Humanitário" },
  T5: { label: "T-5 (Irmão de T-1)", group: "Humanitário" },

  U1: { label: "U-1 (Vítima de crimes — principal)", group: "Humanitário" },
  U2: { label: "U-2 (Cônjuge de U-1)", group: "Humanitário" },
  U3: { label: "U-3 (Filho de U-1)", group: "Humanitário" },
  U4: { label: "U-4 (Pai de U-1)", group: "Humanitário" },
  U5: { label: "U-5 (Irmão de U-1)", group: "Humanitário" },

  S5: { label: "S-5 (Informante — criminal)", group: "Especiais" },
  S6: { label: "S-6 (Informante — terrorismo)", group: "Especiais" },
  S7: { label: "S-7 (Dependente de S)", group: "Especiais" },

  N8: { label: "N-8 (Pai de special immigrant)", group: "Especiais" },
  N9: { label: "N-9 (Filho de special immigrant)", group: "Especiais" },

  V1: { label: "V-1 (Cônjuge de LPR — ponte)", group: "Família (ponte)" },
  V2: { label: "V-2 (Filho de LPR — ponte)", group: "Família (ponte)" },
  V3: { label: "V-3 (Filho do V-1/V-2)", group: "Família (ponte)" },

  // —————————————————————————————————————————————————
  // IMIGRANTES — EMPREGO (EB)
  // —————————————————————————————————————————————————
  EB1A: { label: "EB-1A (Extraordinary Ability)", group: "Imigrante (Emprego)" },
  EB1B: { label: "EB-1B (Outstanding Researcher/Professor)", group: "Imigrante (Emprego)" },
  EB1C: { label: "EB-1C (Multinational Manager/Executive)", group: "Imigrante (Emprego)" },

  EB2:     { label: "EB-2 (PERM)", group: "Imigrante (Emprego)" },
  EB2_NIW: { label: "EB-2 NIW (National Interest Waiver)", group: "Imigrante (Emprego)" },
  EB2_SCHEDULE_A: { label: "EB-2 (Schedule A)", group: "Imigrante (Emprego)" },

  EB3_PROF: { label: "EB-3 (Professional)", group: "Imigrante (Emprego)" },
  EB3_SKILLED: { label: "EB-3 (Skilled Worker)", group: "Imigrante (Emprego)" },
  EB3_OTHER: { label: "EB-3 (Other Worker)", group: "Imigrante (Emprego)" },

  EB4: { label: "EB-4 (Special Immigrant)", group: "Imigrante (Emprego)" }, // inclui religiosos, SIJ etc.

  EB5: { label: "EB-5 (Investor)", group: "Imigrante (Emprego)" },
  EB5_RURAL: { label: "EB-5 (Rural/TEA)", group: "Imigrante (Emprego)" },

  // SIV (Iraque/Afeganistão)
  SI: { label: "SI (Iraqi/Afghan Interpreter/Translator SIV)", group: "Imigrante (Especial)" },
  SQ: { label: "SQ (Iraqi/Afghan SIV)", group: "Imigrante (Especial)" },

  // —————————————————————————————————————————————————
  // IMIGRANTES — FAMÍLIA / DV
  // —————————————————————————————————————————————————
  IR1: { label: "IR-1 (Cônjuge de cidadão — 2+ anos)", group: "Imigrante (Família)" },
  CR1: { label: "CR-1 (Cônjuge de cidadão — condicional <2 anos)", group: "Imigrante (Família)" },
  IR2: { label: "IR-2 (Filho solteiro <21 de cidadão)", group: "Imigrante (Família)" },
  CR2: { label: "CR-2 (Filho condicional)", group: "Imigrante (Família)" },
  IR5: { label: "IR-5 (Pai/mãe de cidadão >=21)", group: "Imigrante (Família)" },

  FAMILY: { label: "Family-Based (Preferential: F1, F2A/F2B, F3, F4)", group: "Imigrante (Família)" },

  DV: { label: "DV (Diversity Visa)", group: "Imigrante (DV)" },

  // —————————————————————————————————————————————————
  // FALLBACKS / SINÔNIMOS QUE APARECEM
  // —————————————————————————————————————————————————
  B1B2: { label: "B-1/B-2 (Negócios/Turismo)", group: "Visita" }, // variante comum de string
  C1_D: { label: "C-1/D (Trânsito + Tripulante)", group: "Tripulantes" },
};

// Label “bonito” + fallback para códigos novos
export function prettyVisaLabel(code?: string): string {
  if (!code) return "Visto (indefinido)";
  const key = code.toUpperCase().replace(/\s+/g, "").replace(/-/g, "").replace(/\//g, "");
  const meta = VISA_META[key] || VISA_META[code] || VISA_META[code.toUpperCase()];
  if (meta?.label) return meta.label;

  // beautify genérico: EB2_NIW -> "EB-2 NIW", H1B -> "H-1B", C1D -> "C-1/D"
  const beautified = code
    .toUpperCase()
    .replace(/_/g, " ")
    .replace(/\bEB(\d)\b/g, "EB-$1")
    .replace(/\bH(\d)B\b/g, "H-$1B")
    .replace(/\bH(\d)A\b/g, "H-$1A")
    .replace(/\bL(\d)\b/g, "L-$1")
    .replace(/\bO(\d)\b/g, "O-$1")
    .replace(/\bP(\d)\b/g, "P-$1")
    .replace(/\bJ(\d)\b/g, "J-$1")
    .replace(/\bF(\d)\b/g, "F-$1")
    .replace(/\bM(\d)\b/g, "M-$1")
    .replace(/\bE(\d)\b/g, "E-$1")
    .replace(/\bNATO(\d)\b/g, "NATO-$1")
    .replace(/\bC1D\b/g, "C-1/D")
    .replace(/\bB1B2\b/g, "B-1/B-2");
  return beautified;
}

export function visaGroup(code?: string): string {
  const key = code?.toUpperCase() ?? "";
  const meta = VISA_META[key] || VISA_META[key.replace(/[\s\-\/]/g, "")];
  return meta?.group ?? "Outros";
}
