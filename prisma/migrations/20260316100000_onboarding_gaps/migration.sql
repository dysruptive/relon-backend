-- GAP-14: Separate demo data seed flag so it doesn't share state with onboardingAddedLead
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "demoDataSeeded" BOOLEAN NOT NULL DEFAULT false;

-- GAP-15: Add expiry to email verification token
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailVerificationTokenExpiry" TIMESTAMP(3);
