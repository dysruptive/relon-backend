-- CreateTable: organizations
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "industry" TEXT,
    "size" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "planStatus" TEXT NOT NULL DEFAULT 'active',
    "trialEndsAt" TIMESTAMP(3),
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- ────────────────────────────────────────────────────────────────────────────
-- Insert a default / legacy organization so existing rows can be back-filled.
-- We use a fixed, predictable UUID so it matches the seed script expectations.
-- ────────────────────────────────────────────────────────────────────────────
INSERT INTO "organizations" ("id", "name", "slug", "industry", "size", "plan", "planStatus", "updatedAt")
VALUES (
  'legacy-org-00000000-0000-0000-0000-000000000001',
  'Relon Demo',
  'relon-demo',
  'Construction',
  '11-50',
  'scale',
  'active',
  CURRENT_TIMESTAMP
);

-- ────────────────────────────────────────────────────────────────────────────
-- Add organizationId as nullable to every tenant-scoped table, back-fill,
-- then enforce NOT NULL + FK.
-- ────────────────────────────────────────────────────────────────────────────

-- users
ALTER TABLE "users" ADD COLUMN "organizationId" TEXT;
UPDATE "users" SET "organizationId" = 'legacy-org-00000000-0000-0000-0000-000000000001';
ALTER TABLE "users" ALTER COLUMN "organizationId" SET NOT NULL;

-- teams
ALTER TABLE "teams" ADD COLUMN "organizationId" TEXT;
UPDATE "teams" SET "organizationId" = 'legacy-org-00000000-0000-0000-0000-000000000001';
ALTER TABLE "teams" ALTER COLUMN "organizationId" SET NOT NULL;

-- leads
ALTER TABLE "leads" ADD COLUMN "organizationId" TEXT;
UPDATE "leads" SET "organizationId" = 'legacy-org-00000000-0000-0000-0000-000000000001';
ALTER TABLE "leads" ALTER COLUMN "organizationId" SET NOT NULL;

-- lead_reps
ALTER TABLE "lead_reps" ADD COLUMN "organizationId" TEXT;
UPDATE "lead_reps" SET "organizationId" = 'legacy-org-00000000-0000-0000-0000-000000000001';
ALTER TABLE "lead_reps" ALTER COLUMN "organizationId" SET NOT NULL;

-- service_types
ALTER TABLE "service_types" ADD COLUMN "organizationId" TEXT;
UPDATE "service_types" SET "organizationId" = 'legacy-org-00000000-0000-0000-0000-000000000001';
ALTER TABLE "service_types" ALTER COLUMN "organizationId" SET NOT NULL;

-- activities
ALTER TABLE "activities" ADD COLUMN "organizationId" TEXT;
UPDATE "activities" SET "organizationId" = 'legacy-org-00000000-0000-0000-0000-000000000001';
ALTER TABLE "activities" ALTER COLUMN "organizationId" SET NOT NULL;

-- files
ALTER TABLE "files" ADD COLUMN "organizationId" TEXT;
UPDATE "files" SET "organizationId" = 'legacy-org-00000000-0000-0000-0000-000000000001';
ALTER TABLE "files" ALTER COLUMN "organizationId" SET NOT NULL;

-- stage_history
ALTER TABLE "stage_history" ADD COLUMN "organizationId" TEXT;
UPDATE "stage_history" SET "organizationId" = 'legacy-org-00000000-0000-0000-0000-000000000001';
ALTER TABLE "stage_history" ALTER COLUMN "organizationId" SET NOT NULL;

-- clients
ALTER TABLE "clients" ADD COLUMN "organizationId" TEXT;
UPDATE "clients" SET "organizationId" = 'legacy-org-00000000-0000-0000-0000-000000000001';
ALTER TABLE "clients" ALTER COLUMN "organizationId" SET NOT NULL;

-- projects
ALTER TABLE "projects" ADD COLUMN "organizationId" TEXT;
UPDATE "projects" SET "organizationId" = 'legacy-org-00000000-0000-0000-0000-000000000001';
ALTER TABLE "projects" ALTER COLUMN "organizationId" SET NOT NULL;

-- cost_logs
ALTER TABLE "cost_logs" ADD COLUMN "organizationId" TEXT;
UPDATE "cost_logs" SET "organizationId" = 'legacy-org-00000000-0000-0000-0000-000000000001';
ALTER TABLE "cost_logs" ALTER COLUMN "organizationId" SET NOT NULL;

-- project_status_history
ALTER TABLE "project_status_history" ADD COLUMN "organizationId" TEXT;
UPDATE "project_status_history" SET "organizationId" = 'legacy-org-00000000-0000-0000-0000-000000000001';
ALTER TABLE "project_status_history" ALTER COLUMN "organizationId" SET NOT NULL;

-- ai_settings
ALTER TABLE "ai_settings" ADD COLUMN "organizationId" TEXT;
UPDATE "ai_settings" SET "organizationId" = 'legacy-org-00000000-0000-0000-0000-000000000001';
ALTER TABLE "ai_settings" ALTER COLUMN "organizationId" SET NOT NULL;

-- audit_logs
ALTER TABLE "audit_logs" ADD COLUMN "organizationId" TEXT;
UPDATE "audit_logs" SET "organizationId" = 'legacy-org-00000000-0000-0000-0000-000000000001';
ALTER TABLE "audit_logs" ALTER COLUMN "organizationId" SET NOT NULL;

-- role_permissions
ALTER TABLE "role_permissions" ADD COLUMN "organizationId" TEXT;
UPDATE "role_permissions" SET "organizationId" = 'legacy-org-00000000-0000-0000-0000-000000000001';
ALTER TABLE "role_permissions" ALTER COLUMN "organizationId" SET NOT NULL;

-- pipeline_stages
ALTER TABLE "pipeline_stages" ADD COLUMN "organizationId" TEXT;
UPDATE "pipeline_stages" SET "organizationId" = 'legacy-org-00000000-0000-0000-0000-000000000001';
ALTER TABLE "pipeline_stages" ALTER COLUMN "organizationId" SET NOT NULL;

-- dropdown_options
ALTER TABLE "dropdown_options" ADD COLUMN "organizationId" TEXT;
UPDATE "dropdown_options" SET "organizationId" = 'legacy-org-00000000-0000-0000-0000-000000000001';
ALTER TABLE "dropdown_options" ALTER COLUMN "organizationId" SET NOT NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- Add Foreign Key constraints
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "teams" ADD CONSTRAINT "teams_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "leads" ADD CONSTRAINT "leads_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lead_reps" ADD CONSTRAINT "lead_reps_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_types" ADD CONSTRAINT "service_types_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "activities" ADD CONSTRAINT "activities_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "files" ADD CONSTRAINT "files_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stage_history" ADD CONSTRAINT "stage_history_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "clients" ADD CONSTRAINT "clients_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_logs" ADD CONSTRAINT "cost_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_status_history" ADD CONSTRAINT "project_status_history_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ai_settings" ADD CONSTRAINT "ai_settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dropdown_options" ADD CONSTRAINT "dropdown_options_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ────────────────────────────────────────────────────────────────────────────
-- Drop old unique constraints and create new org-scoped ones
-- ────────────────────────────────────────────────────────────────────────────

-- users: was @unique email, now @@unique([organizationId, email])
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_email_key";
CREATE UNIQUE INDEX "users_organizationId_email_key" ON "users"("organizationId", "email");

-- ai_settings: now one per org
ALTER TABLE "ai_settings" DROP CONSTRAINT IF EXISTS "ai_settings_pkey";
CREATE UNIQUE INDEX "ai_settings_organizationId_key" ON "ai_settings"("organizationId");

-- role_permissions: org-scoped composite unique
ALTER TABLE "role_permissions" DROP CONSTRAINT IF EXISTS "role_permissions_role_permission_key";
CREATE UNIQUE INDEX "role_permissions_organizationId_role_permission_key" ON "role_permissions"("organizationId", "role", "permission");

-- pipeline_stages: org-scoped composite unique
ALTER TABLE "pipeline_stages" DROP CONSTRAINT IF EXISTS "pipeline_stages_name_pipelineType_key";
CREATE UNIQUE INDEX "pipeline_stages_organizationId_name_pipelineType_key" ON "pipeline_stages"("organizationId", "name", "pipelineType");

-- dropdown_options: org-scoped composite unique
ALTER TABLE "dropdown_options" DROP CONSTRAINT IF EXISTS "dropdown_options_category_value_key";
CREATE UNIQUE INDEX "dropdown_options_organizationId_category_value_key" ON "dropdown_options"("organizationId", "category", "value");

-- service_types: org-scoped unique name
ALTER TABLE "service_types" DROP CONSTRAINT IF EXISTS "service_types_name_key";
CREATE UNIQUE INDEX "service_types_organizationId_name_key" ON "service_types"("organizationId", "name");

-- ────────────────────────────────────────────────────────────────────────────
-- Add indexes on organizationId for query performance
-- ────────────────────────────────────────────────────────────────────────────
CREATE INDEX "users_organizationId_idx" ON "users"("organizationId");
CREATE INDEX "teams_organizationId_idx" ON "teams"("organizationId");
CREATE INDEX "leads_organizationId_idx" ON "leads"("organizationId");
CREATE INDEX "lead_reps_organizationId_idx" ON "lead_reps"("organizationId");
CREATE INDEX "service_types_organizationId_idx" ON "service_types"("organizationId");
CREATE INDEX "activities_organizationId_idx" ON "activities"("organizationId");
CREATE INDEX "files_organizationId_idx" ON "files"("organizationId");
CREATE INDEX "stage_history_organizationId_idx" ON "stage_history"("organizationId");
CREATE INDEX "clients_organizationId_idx" ON "clients"("organizationId");
CREATE INDEX "projects_organizationId_idx" ON "projects"("organizationId");
CREATE INDEX "cost_logs_organizationId_idx" ON "cost_logs"("organizationId");
CREATE INDEX "project_status_history_organizationId_idx" ON "project_status_history"("organizationId");
CREATE INDEX "audit_logs_organizationId_idx" ON "audit_logs"("organizationId");
CREATE INDEX "role_permissions_organizationId_idx" ON "role_permissions"("organizationId");
CREATE INDEX "pipeline_stages_organizationId_idx" ON "pipeline_stages"("organizationId");
CREATE INDEX "dropdown_options_organizationId_idx" ON "dropdown_options"("organizationId");
