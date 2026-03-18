-- Change urgency from LeadUrgency enum to String
ALTER TABLE "leads" ALTER COLUMN "urgency" TYPE TEXT;
DROP TYPE IF EXISTS "LeadUrgency";
