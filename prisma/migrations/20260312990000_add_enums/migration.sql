-- CreateEnum (idempotent — partial prior run may have already created some)
DO $$ BEGIN
  CREATE TYPE "OrgPlan" AS ENUM ('trial', 'starter', 'growth', 'scale');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "OrgPlanStatus" AS ENUM ('active', 'past_due', 'cancelled', 'trialing', 'suspended', 'cancelling', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "LeadStage" AS ENUM ('New', 'Contacted', 'Quoted', 'Negotiation', 'Won', 'Lost');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "LeadUrgency" AS ENUM ('Low', 'Medium', 'High');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('CEO', 'ADMIN', 'BDM', 'SALES', 'DESIGNER', 'QS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "UserStatus" AS ENUM ('Active', 'Inactive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AlterTable: organizations.plan (must drop default before casting)
ALTER TABLE "organizations" ALTER COLUMN "plan" DROP DEFAULT;
ALTER TABLE "organizations" ALTER COLUMN "plan" TYPE "OrgPlan" USING "plan"::"OrgPlan";
ALTER TABLE "organizations" ALTER COLUMN "plan" SET DEFAULT 'trial'::"OrgPlan";

-- AlterTable: organizations.planStatus (must drop default before casting)
ALTER TABLE "organizations" ALTER COLUMN "planStatus" DROP DEFAULT;
ALTER TABLE "organizations" ALTER COLUMN "planStatus" TYPE "OrgPlanStatus" USING "planStatus"::"OrgPlanStatus";
ALTER TABLE "organizations" ALTER COLUMN "planStatus" SET DEFAULT 'active'::"OrgPlanStatus";

-- AlterTable: leads.stage
ALTER TABLE "leads" ALTER COLUMN "stage" TYPE "LeadStage" USING "stage"::"LeadStage";

-- AlterTable: leads.urgency
ALTER TABLE "leads" ALTER COLUMN "urgency" TYPE "LeadUrgency" USING "urgency"::"LeadUrgency";

-- AlterTable: users.role
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole" USING "role"::"UserRole";

-- AlterTable: users.status (must drop default before casting)
ALTER TABLE "users" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "status" TYPE "UserStatus" USING "status"::"UserStatus";
ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'Active'::"UserStatus";
