-- Add composite indexes for the 6 hot query patterns identified in the audit

-- leads: list by org + stage (pipeline view, most frequent query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "leads_orgId_stage_createdAt_idx"
  ON "leads"("organizationId", "stage", "createdAt")
  WHERE "deletedAt" IS NULL;

-- leads: list by org + assigned rep (BDM/SALES dashboard)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "leads_orgId_assignedToId_idx"
  ON "leads"("organizationId", "assignedToId")
  WHERE "deletedAt" IS NULL;

-- clients: list by org + status + accountManager (account manager views)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "clients_orgId_status_idx"
  ON "clients"("organizationId", "status")
  WHERE "deletedAt" IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "clients_orgId_accountManagerId_idx"
  ON "clients"("organizationId", "accountManagerId")
  WHERE "deletedAt" IS NULL;

-- projects: list by org + status (project board)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "projects_orgId_status_idx"
  ON "projects"("organizationId", "status")
  WHERE "deletedAt" IS NULL;

-- audit_logs: list by org + action (admin audit log filtering)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "audit_logs_orgId_action_idx"
  ON "audit_logs"("organizationId", "action");
