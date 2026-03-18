-- Add isOnboarded column to users table
-- Existing users are already onboarded, so default them to true via backfill
ALTER TABLE "users" ADD COLUMN "is_onboarded" BOOLEAN NOT NULL DEFAULT false;

-- All existing users have already completed onboarding
UPDATE "users" SET "is_onboarded" = true;
