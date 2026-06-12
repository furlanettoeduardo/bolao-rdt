-- AlterTable: cronômetro interno do jogo ao vivo
ALTER TABLE "Match" ADD COLUMN "liveSegmentStart" TIMESTAMP(3);
ALTER TABLE "Match" ADD COLUMN "clockBaseMinutes" INTEGER;
