-- Add soft delete (deletedAt) to core models
-- Records are never permanently deleted — services update deletedAt instead

ALTER TABLE "leads" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "leads_deletedAt_idx" ON "leads"("deletedAt");

ALTER TABLE "clients" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "clients_deletedAt_idx" ON "clients"("deletedAt");

ALTER TABLE "projects" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "projects_deletedAt_idx" ON "projects"("deletedAt");

ALTER TABLE "users" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");
