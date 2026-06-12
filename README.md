# Bolão da Copa do Mundo 2026

Bolão completo da Copa do Mundo FIFA 2026: cada participante registra palpites de placar para os 104 jogos, escolhe seu campeão e acompanha o ranking com placares quase em tempo real, sincronizados automaticamente da [Football-Data.org](https://www.football-data.org/). Interface 100% em português do Brasil, mobile-first e acessível.

- Palpites com salvamento otimista e trava automática no horário do jogo (kickoff, sempre em UTC no servidor)
- Ranking com critérios de desempate e ranking por fase
- Tabelas de grupos, chaveamento do mata-mata e jogos ao vivo
- Painel administrativo com sincronização manual e edição de resultados

## Stack

| Camada | Tecnologia |
| --- | --- |
| Framework | [Next.js 16](https://nextjs.org/) (App Router, Server Components) + React 19 |
| Linguagem | TypeScript estrito (`noUncheckedIndexedAccess`) |
| Estilo | Tailwind CSS v4 |
| Banco de dados | PostgreSQL ([Neon](https://neon.tech/)) via Prisma ORM |
| Autenticação | Auth.js v5 (NextAuth) — Credentials + sessão JWT |
| Dados ao vivo | SWR (revalidação no cliente) + Football-Data.org (cacheada no banco) |
| Testes | Vitest |
| Hospedagem | Vercel (plano Hobby) |

## Regras de pontuação

O palpite vale sempre para o **tempo regulamentar (90 minutos)** — prorrogação e pênaltis não alteram o placar usado na pontuação, mas contam para o bônus de classificação no mata-mata.

| Acerto | Pontos |
| --- | ---: |
| Placar exato | **10** |
| Resultado certo (vencedor/empate) + nº de gols de um dos times | **7** |
| Apenas o resultado certo | **5** |
| Resultado errado, mas acertou os gols de um dos times | **2** |
| Nenhum acerto | **0** |
| Bônus mata-mata: acertou quem avançou (vale prorrogação/pênaltis) | **+3** |
| Bônus campeão: acertou o campeão do torneio (creditado ao final) | **+15** |

**Desempate no ranking**, nesta ordem:

1. Mais pontos
2. Mais placares exatos
3. Mais resultados certos
4. Data de cadastro mais antiga

**Outras regras:**

- **Trava de palpite:** cada jogo trava exatamente no kickoff, comparado **em UTC no servidor** — o relógio do navegador nunca é considerado. O jogo também trava assim que sai do status "agendado" (ao vivo, suspenso, encerrado).
- **Anti-cópia:** os palpites dos outros participantes só ficam visíveis **depois** que o jogo trava. Antes disso, aparece apenas quem já palpitou.
- **Palpite de campeão:** pode ser criado e alterado livremente **até o kickoff do primeiro jogo do mata-mata**. Depois disso, fica congelado.
- **Mata-mata:** quando o palpite é empate no tempo regulamentar, o participante indica também quem avança; caso contrário, o classificado é inferido do próprio placar.
- **Jogos adiados:** ficam travados até a sincronização gravar o novo horário — aí os palpites reabrem automaticamente.

Todos os valores vivem em [`lib/config.ts`](lib/config.ts) (`SCORING`).

## Formato do torneio

A Copa de 2026 (Estados Unidos, México e Canadá) é a primeira com **48 seleções**:

- **12 grupos** (A a L) com 4 seleções cada
- Avançam os **2 primeiros de cada grupo + os 8 melhores terceiros colocados** (32 classificados)
- Nova fase de **16 avos de final** (fase de 32), seguida de oitavas, quartas, semifinais, disputa de 3º lugar e final
- **104 jogos** no total

## Setup local

### Pré-requisitos

- Node.js 20+
- PostgreSQL local **ou** uma conta gratuita no [Neon](https://neon.tech/)

### Passo a passo

```bash
git clone <url-do-repositorio>
cd bolao-rdt
npm install
```

Copie o arquivo de exemplo e preencha as variáveis:

```bash
cp .env.example .env
```

| Variável | Obrigatória | Descrição |
| --- | :---: | --- |
| `DATABASE_URL` | Sim | Connection string do Postgres **com pooling** (no Neon, a URL com sufixo `-pooler` e `pgbouncer=true`). Usada pelo app em runtime. |
| `DIRECT_URL` | Sim | Connection string **direta** (sem pooler) — usada apenas por `prisma migrate`. Em dev local pode ser igual à `DATABASE_URL`. |
| `AUTH_SECRET` | Sim | Segredo de sessão do Auth.js. Gere com `npx auth secret` (ou `openssl rand -base64 32`). |
| `FOOTBALL_DATA_TOKEN` | Sim | Token gratuito da Football-Data.org (veja abaixo). |
| `CRON_SECRET` | Sim | Segredo que protege o endpoint `/api/cron/sync` (header `Authorization: Bearer <CRON_SECRET>`). |
| `REGISTRATION_CODE` | Não | Se definido, o cadastro exige este código de acesso (bolão fechado para convidados). |
| `ADMIN_EMAIL` | Não | O usuário cadastrado com este e-mail vira **ADMIN** automaticamente. |
| `NEXT_PUBLIC_APP_URL` | Sim | URL pública da aplicação, sem barra final (ex.: `http://localhost:3000`). |

### Token gratuito da Football-Data.org

1. Registre-se em <https://www.football-data.org/client/register> (gratuito)
2. O token chega por e-mail — cole em `FOOTBALL_DATA_TOKEN`
3. O free tier permite **10 requisições por minuto**, o que é mais que suficiente: o app faz poucas chamadas por sincronização e **cacheia tudo no banco** — as páginas nunca chamam a API externa diretamente

### Banco, seed e servidor

```bash
# Aplica as migrações (já versionadas em prisma/migrations)
npx prisma migrate deploy

# Importa as 48 seleções e os 104 jogos reais da Copa 2026 — nada é inventado
npm run seed

# Sobe o servidor de desenvolvimento
npm run dev
```

Acesse <http://localhost:3000>, crie sua conta (se `ADMIN_EMAIL` apontar para o seu e-mail, você nasce admin) e bom bolão.

## Testes

```bash
npm test          # Vitest — regras de pontuação e de trava de palpite
npm run test:watch
```

## Deploy na Vercel

1. **Importe o repositório** na Vercel (plano Hobby funciona).
2. **Crie o Postgres Neon** pela aba **Storage / Marketplace** do projeto na Vercel. A integração nativa preenche `DATABASE_URL` (já com pooler) automaticamente. Crie manualmente a env `DIRECT_URL` com a mesma connection string **sem** o sufixo `-pooler` (disponível no painel do Neon).
3. **Configure as demais variáveis** de ambiente: `AUTH_SECRET`, `FOOTBALL_DATA_TOKEN`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL` (e, se quiser, `REGISTRATION_CODE` e `ADMIN_EMAIL`).
4. **Faça o deploy.** O script `postinstall` roda `prisma generate` automaticamente.
5. **Rode as migrações** de uma das formas:
   - Localmente, apontando para o banco de produção:

     ```bash
     DATABASE_URL="<url-producao>" DIRECT_URL="<url-direta-producao>" npx prisma migrate deploy
     ```

   - Ou configure o **Build Command** na Vercel como `prisma migrate deploy && next build` (as migrações rodam a cada deploy).
6. **Rode o seed** apontando para o banco de produção (mesmo esquema de envs do passo anterior, com `npm run seed`).
7. O primeiro usuário cadastrado com o e-mail de `ADMIN_EMAIL` vira admin automaticamente.

## Sincronização de placares

Toda a sincronização passa pelo endpoint **`/api/cron/sync`** (aceita `GET` e `POST`), protegido pelo header `Authorization: Bearer <CRON_SECRET>`:

```bash
curl -X POST "https://SEU-APP.vercel.app/api/cron/sync?scope=window" \
  -H "Authorization: Bearer SEU_CRON_SECRET"
```

| Parâmetro | Efeito |
| --- | --- |
| `?scope=window` (padrão) | Sincroniza a janela "ontem → amanhã" — barato e rápido, ideal para rodar a cada poucos minutos |
| `?scope=full` | Sincroniza **todos** os jogos do torneio — usado como passada de segurança diária |

Três mecanismos trabalham juntos:

1. **Cron nativo da Vercel** ([`vercel.json`](vercel.json)) — o plano Hobby só permite crons **diários**, então ele roda um `scope=full` de segurança todo dia às 06:00 UTC. A Vercel envia o `Bearer CRON_SECRET` automaticamente quando a env existe.
2. **GitHub Actions** ([`.github/workflows/sync.yml`](.github/workflows/sync.yml)) — roda a cada **5 minutos** com `scope=window`, para placares quase em tempo real. Configure nos *Secrets* do repositório (Settings → Secrets and variables → Actions):
   - `APP_URL` → URL pública do app, sem barra final
   - `CRON_SECRET` → o mesmo valor da env na Vercel

   Observação: o GitHub Actions não garante pontualidade — em horários de pico pode atrasar alguns minutos.
3. **Alternativa: [cron-job.org](https://cron-job.org/)** (ou similar) — agende um `POST` para `https://SEU-APP/api/cron/sync?scope=window` com o header `Authorization: Bearer <CRON_SECRET>`. Mais pontual que o Actions.

Se a API externa falhar, o painel **`/admin`** permite disparar a sincronização manualmente e **editar resultados na mão** — a repontuação dos palpites acontece automaticamente. Cada execução fica registrada na tabela `SyncLog`.

## Estrutura de pastas

```
bolao-rdt/
├── app/                  # App Router (Next.js 16)
│   ├── api/
│   │   ├── auth/[...nextauth]/   # Rotas do Auth.js
│   │   ├── cron/sync/            # Endpoint de sincronização (Bearer CRON_SECRET)
│   │   └── live/                 # Placares ao vivo para revalidação via SWR
│   └── ...               # Páginas: jogos, palpites, ranking, grupos, mata-mata, admin
├── components/
│   ├── nav/              # Navegação
│   ├── prediction/       # PredictionCard (palpite com salvamento otimista)
│   ├── ui/               # Card, Badge, Button, Input, EmptyState
│   └── *.tsx             # MatchCard, LocalTime, TeamFlag, LiveRefresh etc.
├── lib/
│   ├── actions/          # Server Actions (auth, palpites, perfil, admin)
│   ├── football/         # Cliente da Football-Data.org (usado SÓ pelo sync)
│   ├── config.ts         # Pontuação (SCORING), fuso padrão, competição
│   ├── scoring.ts        # Cálculo de pontos de um palpite
│   ├── match-rules.ts    # Trava de palpite, visibilidade, janela de sync
│   ├── ranking.ts        # Ranking com desempates
│   ├── queries.ts        # Todas as consultas de leitura (Prisma)
│   └── sync.ts           # Orquestração da sincronização
└── prisma/
    ├── schema.prisma     # User, Team, Match, Prediction, ChampionPick, GroupStanding, SyncLog
    ├── migrations/       # Migrações versionadas
    └── seed.ts           # Importa as 48 seleções e os 104 jogos reais
```

## Troubleshooting

| Problema | Causa / solução |
| --- | --- |
| **HTTP 429 da Football-Data** | Limite do free tier (10 req/min) atingido. Aguarde 1 minuto e tente de novo — o sync normal nunca chega perto do limite. |
| **Prisma `P1001` (can't reach database)** | Verifique a `DATABASE_URL`: use a URL **com pooler** do Neon e mantenha `sslmode=require`. Confirme que o projeto Neon não está suspenso. |
| **"FOOTBALL_DATA_TOKEN não definido"** | A env não foi configurada (no `.env` local ou nas variáveis da Vercel). Sem ela a sincronização não roda — o resto do app funciona. |
| **Seed mostra "1º do Grupo A" etc.** | Normal: antes do sorteio/definição dos confrontos a API retorna placeholders. Rode um sync `full` depois que os times forem definidos. |
| **Horários "errados"** | Tudo é gravado em **UTC** e exibido no fuso do navegador (padrão `America/Sao_Paulo`). O servidor nunca formata datas no fuso local. |
| **Jogo adiado segue travado** | O palpite reabre automaticamente quando a sincronização gravar o **novo horário** do jogo. Force um sync no `/admin` se necessário. |
| **Login quebra em produção** | `AUTH_SECRET` ausente nas envs da Vercel — o Auth.js exige o segredo em produção. Gere com `npx auth secret` e refaça o deploy. |
