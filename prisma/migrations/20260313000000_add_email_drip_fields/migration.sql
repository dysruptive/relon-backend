-- Add email drip tracking fields to organizations
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "emailSentDay1" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "emailSentDay3" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "emailSentDay7" BOOLEAN NOT NULL DEFAULT false;

-- Add onboarding checklist fields
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "onboardingAddedLead" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "onboardingInvitedTeam" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "onboardingSetPipeline" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false;
