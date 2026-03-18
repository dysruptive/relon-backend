-- Add name-per-org unique constraints to prevent duplicate names within the same organization

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "clients_orgId_name_key"
  ON "clients"("organizationId", "name") WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "teams_orgId_name_key"
  ON "teams"("organizationId", "name");

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "task_types_orgId_name_key"
  ON "task_types"("organizationId", "name");

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "workflow_rules_orgId_name_key"
  ON "workflow_rules"("organizationId", "name");

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "lead_forms_orgId_name_key"
  ON "lead_forms"("organizationId", "name");

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "products_orgId_name_key"
  ON "products"("organizationId", "name");
