-- CreateTable
CREATE TABLE IF NOT EXISTS "quickbooks_connections" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "realmId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiry" TIMESTAMP(3) NOT NULL,
    "companyName" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quickbooks_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "quickbooks_syncs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "realmId" TEXT,
    "direction" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "externalId" TEXT,
    "internalId" TEXT,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quickbooks_syncs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "quickbooks_connections_organizationId_realmId_key" ON "quickbooks_connections"("organizationId", "realmId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "quickbooks_connections_organizationId_idx" ON "quickbooks_connections"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "quickbooks_syncs_organizationId_syncedAt_idx" ON "quickbooks_syncs"("organizationId", "syncedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "quickbooks_syncs_entityType_direction_idx" ON "quickbooks_syncs"("entityType", "direction");

-- AddForeignKey (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quickbooks_connections_organizationId_fkey'
  ) THEN
    ALTER TABLE "quickbooks_connections" ADD CONSTRAINT "quickbooks_connections_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quickbooks_syncs_organizationId_fkey'
  ) THEN
    ALTER TABLE "quickbooks_syncs" ADD CONSTRAINT "quickbooks_syncs_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AlterTable: add qb_customer_id to clients (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'qbCustomerId'
  ) THEN
    ALTER TABLE "clients" ADD COLUMN "qbCustomerId" TEXT;
  END IF;
END $$;

-- AlterTable: add qb_invoice_id and qb_payment_status to quotes (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'qbInvoiceId'
  ) THEN
    ALTER TABLE "quotes" ADD COLUMN "qbInvoiceId" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'qbPaymentStatus'
  ) THEN
    ALTER TABLE "quotes" ADD COLUMN "qbPaymentStatus" TEXT;
  END IF;
END $$;

-- AlterTable: add qb_item_id to service_items (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_items' AND column_name = 'qbItemId'
  ) THEN
    ALTER TABLE "service_items" ADD COLUMN "qbItemId" TEXT;
  END IF;
END $$;
