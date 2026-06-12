// Tradução dos nomes das seleções para pt-BR, indexada pela sigla (TLA) — que
// é estável mesmo que a API mude o texto em inglês. Aplicada no ponto único
// `toTeamDTO` (lib/queries.ts), então vale para todo o site.
// Use teamNamePt(code, fallback): cai no nome original se a sigla for nova.

const TEAM_NAMES_PT: Record<string, string> = {
  ALG: "Argélia",
  ARG: "Argentina",
  AUS: "Austrália",
  AUT: "Áustria",
  BEL: "Bélgica",
  BIH: "Bósnia e Herzegovina",
  BRA: "Brasil",
  CAN: "Canadá",
  CIV: "Costa do Marfim",
  COD: "Congo (RD)",
  COL: "Colômbia",
  CPV: "Cabo Verde",
  CRO: "Croácia",
  CUW: "Curaçao",
  CZE: "Tchéquia",
  ECU: "Equador",
  EGY: "Egito",
  ENG: "Inglaterra",
  ESP: "Espanha",
  FRA: "França",
  GER: "Alemanha",
  GHA: "Gana",
  HAI: "Haiti",
  IRN: "Irã",
  IRQ: "Iraque",
  JOR: "Jordânia",
  JPN: "Japão",
  KOR: "Coreia do Sul",
  KSA: "Arábia Saudita",
  MAR: "Marrocos",
  MEX: "México",
  NED: "Países Baixos",
  NOR: "Noruega",
  NZL: "Nova Zelândia",
  PAN: "Panamá",
  PAR: "Paraguai",
  POR: "Portugal",
  QAT: "Catar",
  RSA: "África do Sul",
  SCO: "Escócia",
  SEN: "Senegal",
  SUI: "Suíça",
  SWE: "Suécia",
  TUN: "Tunísia",
  TUR: "Turquia",
  URY: "Uruguai",
  USA: "Estados Unidos",
  UZB: "Uzbequistão",
};

/** Nome da seleção em pt-BR pela sigla; cai no fallback (nome da API) se não houver tradução. */
export function teamNamePt(code: string, fallback: string): string {
  return TEAM_NAMES_PT[code] ?? fallback;
}
