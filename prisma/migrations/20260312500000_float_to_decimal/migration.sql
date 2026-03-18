-- AlterTable: Convert DOUBLE PRECISION financial fields to DECIMAL(12,2) for monetary precision
-- Affects: leads, clients, projects, cost_logs, products

ALTER TABLE "leads"
  ALTER COLUMN "expectedValue" TYPE DECIMAL(12,2),
  ALTER COLUMN "contractedValue" TYPE DECIMAL(12,2);

ALTER TABLE "clients"
  ALTER COLUMN "lifetimeRevenue" TYPE DECIMAL(12,2);

ALTER TABLE "projects"
  ALTER COLUMN "contractedValue" TYPE DECIMAL(12,2),
  ALTER COLUMN "endOfProjectValue" TYPE DECIMAL(12,2),
  ALTER COLUMN "estimatedRevenue" TYPE DECIMAL(12,2),
  ALTER COLUMN "totalCost" TYPE DECIMAL(12,2);

ALTER TABLE "cost_logs"
  ALTER COLUMN "amount" TYPE DECIMAL(12,2);

ALTER TABLE "products"
  ALTER COLUMN "defaultPrice" TYPE DECIMAL(12,2);
