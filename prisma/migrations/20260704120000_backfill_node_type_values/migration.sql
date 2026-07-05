-- Backfills NodeType enum values that are present in the current Prisma schema
-- but were missing from the historical migration chain used by fresh Docker DBs.

ALTER TYPE "NodeType" ADD VALUE IF NOT EXISTS 'GOOGLE_FORM_TRIGGER';
ALTER TYPE "NodeType" ADD VALUE IF NOT EXISTS 'STRIPE_TRIGGER';
ALTER TYPE "NodeType" ADD VALUE IF NOT EXISTS 'ANTHROPIC';
ALTER TYPE "NodeType" ADD VALUE IF NOT EXISTS 'GEMINI';
ALTER TYPE "NodeType" ADD VALUE IF NOT EXISTS 'OPENAI';
ALTER TYPE "NodeType" ADD VALUE IF NOT EXISTS 'DISCORD';
ALTER TYPE "NodeType" ADD VALUE IF NOT EXISTS 'SLACK';
