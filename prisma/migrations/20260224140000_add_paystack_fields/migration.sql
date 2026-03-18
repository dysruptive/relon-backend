ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "paystackCustomerId" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "paystackSubscriptionCode" TEXT;
