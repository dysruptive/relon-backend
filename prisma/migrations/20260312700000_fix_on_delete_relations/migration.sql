-- Fix missing onDelete: Cascade on Organization FK for models that were RESTRICT by default.
-- This prevents "cannot delete organization" errors for these tables.

-- products
ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_organizationId_fkey";
ALTER TABLE "products" ADD CONSTRAINT "products_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- tenant_settings
ALTER TABLE "tenant_settings" DROP CONSTRAINT IF EXISTS "tenant_settings_organizationId_fkey";
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- quickbooks_connections
ALTER TABLE "quickbooks_connections" DROP CONSTRAINT IF EXISTS "quickbooks_connections_organizationId_fkey";
ALTER TABLE "quickbooks_connections" ADD CONSTRAINT "quickbooks_connections_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- quickbooks_syncs
ALTER TABLE "quickbooks_syncs" DROP CONSTRAINT IF EXISTS "quickbooks_syncs_organizationId_fkey";
ALTER TABLE "quickbooks_syncs" ADD CONSTRAINT "quickbooks_syncs_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
