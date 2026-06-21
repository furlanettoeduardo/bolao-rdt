-- AlterTable: trava manual do admin. Quando true, o sync com a API NÃO
-- sobrescreve placar/status/quem-avançou deste jogo (a API pode enviar dado
-- errado). O admin pode destravar no painel para devolver o controle ao provedor.
ALTER TABLE "Match" ADD COLUMN "manualOverride" BOOLEAN NOT NULL DEFAULT false;
