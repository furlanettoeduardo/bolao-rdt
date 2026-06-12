// ─────────────────────────────────────────────────────────────────────────────
// Seed do bolão — importa o calendário REAL da Copa do Mundo 2026 a partir da
// Football-Data.org (competição 2000/WC): 48 seleções e 104 jogos.
// Nada é inventado: confrontos, grupos, datas e placeholders vêm da API.
// Idempotente — pode rodar quantas vezes quiser (upsert por externalId).
//
// Uso: npm run seed
// Requer no .env: POSTGRES_PRISMA_URL, DATABASE_URL_UNPOOLED e FOOTBALL_DATA_TOKEN
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";

// tsx não carrega .env sozinho; Node 20.12+ tem loadEnvFile nativo.
try {
  process.loadEnvFile?.(".env");
} catch {
  // Sem .env local (ex.: CI com envs já exportadas) — segue o jogo.
}

import { getProvider } from "../lib/football/provider";
import { isFinishedStatus } from "../lib/match-rules";

const prisma = new PrismaClient();

async function main() {
  const provider = getProvider();

  console.log("→ Buscando as 48 seleções na Football-Data.org…");
  const teams = await provider.getTeams();
  console.log(`  ${teams.length} seleção(ões) recebida(s).`);

  for (const t of teams) {
    await prisma.team.upsert({
      where: { externalId: t.externalId },
      create: {
        externalId: t.externalId,
        name: t.name,
        code: t.code,
        flagUrl: t.flagUrl,
        group: t.group,
      },
      update: {
        name: t.name,
        code: t.code,
        flagUrl: t.flagUrl,
        ...(t.group ? { group: t.group } : {}),
      },
    });
  }

  const teamRows = await prisma.team.findMany({
    select: { id: true, externalId: true, group: true },
  });
  const teamByExternalId = new Map(teamRows.map((t) => [t.externalId, t]));

  console.log("→ Buscando o calendário completo (104 jogos)…");
  const matches = await provider.getMatches();
  console.log(`  ${matches.length} jogo(s) recebido(s).`);
  if (matches.length === 0) {
    throw new Error(
      "A API não retornou jogos. Verifique o token e se a competição WC (2000) está disponível no seu plano."
    );
  }

  // O endpoint de teams não informa o grupo — derivamos dos próprios jogos da
  // fase de grupos (cada jogo traz grupo + os dois times).
  const groupByTeamExternalId = new Map<number, string>();
  for (const m of matches) {
    if (m.stage !== "GROUP" || !m.group) continue;
    if (m.homeTeamExternalId != null) {
      groupByTeamExternalId.set(m.homeTeamExternalId, m.group);
    }
    if (m.awayTeamExternalId != null) {
      groupByTeamExternalId.set(m.awayTeamExternalId, m.group);
    }
  }
  for (const [externalId, group] of groupByTeamExternalId) {
    const team = teamByExternalId.get(externalId);
    if (team && team.group !== group) {
      await prisma.team.update({ where: { id: team.id }, data: { group } });
      team.group = group;
    }
  }

  let created = 0;
  let updated = 0;
  for (const m of matches) {
    const homeTeamId =
      m.homeTeamExternalId != null
        ? (teamByExternalId.get(m.homeTeamExternalId)?.id ?? null)
        : null;
    const awayTeamId =
      m.awayTeamExternalId != null
        ? (teamByExternalId.get(m.awayTeamExternalId)?.id ?? null)
        : null;

    const data = {
      stage: m.stage,
      group: m.group,
      matchday: m.matchday,
      kickoff: new Date(m.kickoffUtc),
      status: m.status,
      homeTeamId,
      awayTeamId,
      homePlaceholder: m.homePlaceholder,
      awayPlaceholder: m.awayPlaceholder,
      homeScore: m.regulation?.home ?? null,
      awayScore: m.regulation?.away ?? null,
      homeScoreET: m.afterExtraTime?.home ?? null,
      awayScoreET: m.afterExtraTime?.away ?? null,
      homePenalties: m.penalties?.home ?? null,
      awayPenalties: m.penalties?.away ?? null,
      venue: m.venue,
      city: m.city,
    };

    const existing = await prisma.match.findUnique({
      where: { externalId: m.externalId },
      select: { id: true, status: true },
    });
    if (existing) {
      // Não reverte o resultado de um jogo já finalizado no banco (ex.: correção
      // manual feita no /admin). Sobrescrever o placar sem repontuar deixaria os
      // pontos inconsistentes — então preserva placar/status e atualiza só os
      // metadados (horário, local, times, placeholders).
      const updateData = isFinishedStatus(existing.status)
        ? {
            ...data,
            status: undefined,
            homeScore: undefined,
            awayScore: undefined,
            homeScoreET: undefined,
            awayScoreET: undefined,
            homePenalties: undefined,
            awayPenalties: undefined,
          }
        : data;
      await prisma.match.update({ where: { id: existing.id }, data: updateData });
      updated++;
    } else {
      await prisma.match.create({
        data: { ...data, externalId: m.externalId },
      });
      created++;
    }
  }
  console.log(`  ${created} jogo(s) criado(s), ${updated} atualizado(s).`);

  // Standings pré-torneio também trazem o grupo de cada time — backup útil
  // caso algum time não tenha aparecido em jogo da fase de grupos.
  try {
    console.log("→ Buscando classificação inicial dos grupos…");
    const rows = await provider.getStandings();
    for (const row of rows) {
      const team = teamByExternalId.get(row.teamExternalId);
      if (!team) continue;
      if (team.group !== row.group) {
        await prisma.team.update({
          where: { id: team.id },
          data: { group: row.group },
        });
        team.group = row.group;
      }
      await prisma.groupStanding.upsert({
        where: { group_teamId: { group: row.group, teamId: team.id } },
        create: {
          group: row.group,
          teamId: team.id,
          position: row.position,
          played: row.played,
          won: row.won,
          drawn: row.drawn,
          lost: row.lost,
          goalsFor: row.goalsFor,
          goalsAgainst: row.goalsAgainst,
          goalDifference: row.goalDifference,
          points: row.points,
        },
        update: {
          position: row.position,
          played: row.played,
          won: row.won,
          drawn: row.drawn,
          lost: row.lost,
          goalsFor: row.goalsFor,
          goalsAgainst: row.goalsAgainst,
          goalDifference: row.goalDifference,
          points: row.points,
        },
      });
    }
    console.log(`  ${rows.length} linha(s) de classificação gravada(s).`);
  } catch (err) {
    console.warn(
      "  Standings indisponíveis no momento (ok antes do torneio):",
      err instanceof Error ? err.message : err
    );
  }

  const summary = await prisma.$transaction([
    prisma.team.count(),
    prisma.match.count(),
  ]);
  console.log(
    `✔ Seed concluído: ${summary[0]} seleções, ${summary[1]} jogos no banco.`
  );
}

main()
  .catch((err) => {
    console.error("✖ Seed falhou:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
