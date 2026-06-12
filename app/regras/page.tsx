import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import type { BadgeVariant } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { APP_NAME, MAX_GOALS, SCORING } from "@/lib/config";
import { STAGE_LABELS } from "@/lib/format";

export const metadata: Metadata = {
  title: "Regras",
  description:
    "Como funciona o bolão da Copa do Mundo FIFA 2026: pontuação, mata-mata, palpite de campeão, trava de palpites e critérios de desempate.",
};

// Página 100% estática: não consulta banco nem sessão.

/** "1 pt" / "0 pts" / "7 pts" */
function pts(n: number): string {
  return `${n} ${n === 1 ? "pt" : "pts"}`;
}

interface ScoringRow {
  label: string;
  description: string;
  example: string;
  points: number;
  variant: BadgeVariant;
}

const SCORING_ROWS: ScoringRow[] = [
  {
    label: "Placar exato",
    description: "Você cravou o placar do tempo regulamentar.",
    example: `Palpite 2×1, resultado 2×1 → ${pts(SCORING.EXACT)}`,
    points: SCORING.EXACT,
    variant: "gold",
  },
  {
    label: "Resultado certo + gols de um dos times",
    description:
      "Acertou quem venceu (ou o empate) e o número de gols de um dos times.",
    example: `Palpite 2×1, resultado 2×0 → ${pts(SCORING.RESULT_AND_ONE_SCORE)}`,
    points: SCORING.RESULT_AND_ONE_SCORE,
    variant: "success",
  },
  {
    label: "Apenas o resultado certo",
    description: "Acertou quem venceu (ou o empate), mas errou os dois placares.",
    example: `Palpite 2×1, resultado 3×0 → ${pts(SCORING.RESULT_ONLY)}`,
    points: SCORING.RESULT_ONLY,
    variant: "info",
  },
  {
    label: "Errou o resultado, acertou os gols de um time",
    description:
      "O resultado saiu diferente do palpite, mas um dos placares bateu.",
    example: `Palpite 2×1, resultado 1×1 → ${pts(SCORING.ONE_SCORE_ONLY)}`,
    points: SCORING.ONE_SCORE_ONLY,
    variant: "neutral",
  },
  {
    label: "Nenhum acerto",
    description: "Errou o resultado e os gols dos dois times.",
    example: `Palpite 2×1, resultado 0×3 → ${pts(SCORING.MISS)}`,
    points: SCORING.MISS,
    variant: "neutral",
  },
];

const TOURNAMENT_FACTS: { term: string; detail: string }[] = [
  { term: "Seleções", detail: "48 seleções, em 12 grupos (A a L) de 4 times." },
  {
    term: "Fase de grupos",
    detail:
      "72 jogos. Avançam o 1º e o 2º de cada grupo + os 8 melhores 3ºs colocados, fechando 32 classificados.",
  },
  {
    term: "Mata-mata",
    detail: `${STAGE_LABELS.ROUND_32} → ${STAGE_LABELS.ROUND_16} → ${STAGE_LABELS.QUARTER} → ${STAGE_LABELS.SEMI} → ${STAGE_LABELS.THIRD_PLACE} → ${STAGE_LABELS.FINAL}.`,
  },
  { term: "Total de jogos", detail: "104 partidas — todas valem palpite." },
  {
    term: "Quando e onde",
    detail:
      "De 11 de junho a 19 de julho de 2026, em estádios dos Estados Unidos, México e Canadá.",
  },
];

const TIEBREAK_ORDER: string[] = [
  "Maior número de pontos",
  "Mais placares exatos",
  "Mais resultados certos",
  "Cadastro mais antigo no bolão",
];

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title}>
      <Card>
        <CardHeader title={title} subtitle={subtitle} />
        <CardBody>{children}</CardBody>
      </Card>
    </section>
  );
}

export default function RegrasPage() {
  return (
    <div className="space-y-6">
      <header className="rounded-xl bg-field-800 px-5 py-6 text-white shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-field-200">
          {APP_NAME}
        </p>
        <h1 className="mt-1 text-2xl font-bold">Regras do bolão</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-field-100">
          Tudo o que você precisa saber para palpitar nos 104 jogos da Copa do
          Mundo FIFA 2026 e brigar pelo topo do ranking.
        </p>
      </header>

      <SectionCard
        title="Como funciona"
        subtitle="Três passos para entrar na disputa"
      >
        <ol className="space-y-3">
          {[
            "Cadastre-se e entre com a sua conta.",
            "Dê o seu palpite de placar para cada um dos 104 jogos antes do horário de início de cada partida.",
            "Acompanhe a apuração automática e a sua posição no ranking ao longo de todo o torneio.",
          ].map((step, index) => (
            <li key={step} className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-field-100 text-xs font-bold text-field-800"
              >
                {index + 1}
              </span>
              <p className="text-sm leading-relaxed text-slate-700">{step}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500">
          Por sanidade do formulário, cada palpite aceita de 0 a {MAX_GOALS}{" "}
          gols por time.
        </p>
      </SectionCard>

      <SectionCard
        title="Pontuação por jogo"
        subtitle="Vale o placar do tempo regulamentar"
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">
              Pontos por tipo de acerto no palpite, com exemplos
            </caption>
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Acerto
                </th>
                <th scope="col" className="py-2 text-right font-semibold">
                  Pontos
                </th>
              </tr>
            </thead>
            <tbody>
              {SCORING_ROWS.map((row) => (
                <tr
                  key={row.label}
                  className="border-b border-slate-100 last:border-b-0"
                >
                  <th scope="row" className="py-3 pr-3 align-top font-normal">
                    <p className="font-semibold text-slate-900">{row.label}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                      {row.description}
                    </p>
                    <p className="mt-1 text-xs font-medium text-field-700">
                      Ex.: {row.example}
                    </p>
                  </th>
                  <td className="py-3 text-right align-top">
                    <Badge variant={row.variant}>{pts(row.points)}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          As categorias não se acumulam: cada palpite recebe a pontuação da
          melhor categoria em que se encaixar.
        </p>
      </SectionCard>

      <SectionCard
        title="Mata-mata"
        subtitle={`Bônus de +${pts(SCORING.ADVANCING_BONUS)} por acertar quem avança`}
      >
        <ul className="space-y-2.5 text-sm leading-relaxed text-slate-700">
          <li className="flex items-start gap-2">
            <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-field-500" />
            <span>
              O palpite de placar continua valendo o{" "}
              <strong className="font-semibold">tempo regulamentar</strong> —
              prorrogação e pênaltis não mudam a pontuação do placar.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-field-500" />
            <span>
              Acertou quem se classificou? Você ganha{" "}
              <strong className="font-semibold">
                +{pts(SCORING.ADVANCING_BONUS)}
              </strong>{" "}
              de bônus — e esse acerto vale mesmo que a vaga seja decidida na
              prorrogação ou nos pênaltis.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-field-500" />
            <span>
              Palpitou em <strong className="font-semibold">empate</strong> no
              tempo regulamentar? Você precisa escolher qual time avança.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-field-500" />
            <span>
              Palpitou em um placar <strong className="font-semibold">com vencedor</strong>?
              O classificado é inferido automaticamente: é o próprio vencedor
              do seu palpite.
            </span>
          </li>
        </ul>
      </SectionCard>

      <SectionCard
        title="Campeão"
        subtitle={`Vale +${pts(SCORING.CHAMPION_BONUS)} no fim do torneio`}
      >
        <p className="text-sm leading-relaxed text-slate-700">
          Além dos palpites jogo a jogo, você aposta em quem levanta a taça.
          Acertou o campeão? São{" "}
          <strong className="font-semibold">
            +{pts(SCORING.CHAMPION_BONUS)}
          </strong>{" "}
          creditados ao final do torneio. O palpite de campeão pode ser
          alterado livremente até o início do{" "}
          <strong className="font-semibold">primeiro jogo do mata-mata</strong>;
          depois disso, fica congelado.
        </p>
      </SectionCard>

      <SectionCard
        title="Trava e anti-cópia"
        subtitle="Sem espiar o palpite alheio antes da bola rolar"
      >
        <ul className="space-y-2.5 text-sm leading-relaxed text-slate-700">
          <li className="flex items-start gap-2">
            <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cup-red" />
            <span>
              Cada palpite <strong className="font-semibold">trava no horário de início</strong>{" "}
              do jogo. A comparação acontece no servidor, em UTC — adiantar o
              relógio do celular não engana o sistema. Os horários são sempre
              exibidos no seu fuso local.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cup-red" />
            <span>
              Os palpites dos outros participantes{" "}
              <strong className="font-semibold">
                só ficam visíveis depois que a partida começa
              </strong>
              . Antes disso, você vê apenas quem já palpitou — nunca o placar
              apostado.
            </span>
          </li>
        </ul>
      </SectionCard>

      <SectionCard
        title="Desempate no ranking"
        subtitle="Critérios aplicados nesta ordem"
      >
        <ol className="space-y-2">
          {TIEBREAK_ORDER.map((criterion, index) => (
            <li key={criterion} className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-field-700 text-xs font-bold text-white"
              >
                {index + 1}
              </span>
              <span className="text-sm text-slate-700">{criterion}</span>
            </li>
          ))}
        </ol>
      </SectionCard>

      <SectionCard
        title="O torneio"
        subtitle="Copa do Mundo FIFA 2026 em números"
      >
        <dl className="divide-y divide-slate-100">
          {TOURNAMENT_FACTS.map((fact) => (
            <div
              key={fact.term}
              className="flex flex-col gap-0.5 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:gap-4"
            >
              <dt className="shrink-0 text-sm font-semibold text-field-800 sm:w-36">
                {fact.term}
              </dt>
              <dd className="text-sm leading-relaxed text-slate-700">
                {fact.detail}
              </dd>
            </div>
          ))}
        </dl>
      </SectionCard>
    </div>
  );
}
