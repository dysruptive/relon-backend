-- Create lead_team_members table
CREATE TABLE "lead_team_members" (
  "id"             TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "organizationId" TEXT NOT NULL,
  "leadId"         TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "roleLabel"      TEXT NOT NULL DEFAULT '',
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lead_team_members_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "lead_team_members"
  ADD CONSTRAINT "lead_team_members_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lead_team_members"
  ADD CONSTRAINT "lead_team_members_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lead_team_members"
  ADD CONSTRAINT "lead_team_members_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "lead_team_members_organizationId_idx" ON "lead_team_members"("organizationId");
CREATE INDEX "lead_team_members_leadId_idx"         ON "lead_team_members"("leadId");
CREATE INDEX "lead_team_members_userId_idx"         ON "lead_team_members"("userId");

-- Migrate existing designer assignments
INSERT INTO "lead_team_members" ("id", "organizationId", "leadId", "userId", "roleLabel", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  l."organizationId",
  l."id",
  l."designerId",
  COALESCE(r."label", 'Designer'),
  NOW(),
  NOW()
FROM "leads" l
LEFT JOIN "roles" r ON r."key" = (SELECT u."role" FROM "users" u WHERE u."id" = l."designerId")
WHERE l."designerId" IS NOT NULL AND l."deletedAt" IS NULL;

-- Migrate existing QS assignments
INSERT INTO "lead_team_members" ("id", "organizationId", "leadId", "userId", "roleLabel", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  l."organizationId",
  l."id",
  l."qsId",
  COALESCE(r."label", 'QS'),
  NOW(),
  NOW()
FROM "leads" l
LEFT JOIN "roles" r ON r."key" = (SELECT u."role" FROM "users" u WHERE u."id" = l."qsId")
WHERE l."qsId" IS NOT NULL AND l."deletedAt" IS NULL;

-- Drop old columns from leads
ALTER TABLE "leads" DROP COLUMN IF EXISTS "designerId";
ALTER TABLE "leads" DROP COLUMN IF EXISTS "qsId";
