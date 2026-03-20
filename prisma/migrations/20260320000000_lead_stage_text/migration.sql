-- Convert leads.stage from LeadStage enum back to TEXT
-- The pipeline stage system uses custom stage names, so a fixed enum is incorrect.
ALTER TABLE "leads" ALTER COLUMN "stage" TYPE TEXT;

-- Drop the enum type (no longer used)
DROP TYPE IF EXISTS "LeadStage";
