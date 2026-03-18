-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "position" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "value" DOUBLE PRECISION NOT NULL,
    "stage" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "urgency" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "expectedCloseDate" TIMESTAMP(3),
    "notes" TEXT,
    "aiRiskLevel" TEXT,
    "aiSummary" TEXT,
    "aiRecommendations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "lifetimeRevenue" DOUBLE PRECISION NOT NULL,
    "accountManager" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "healthScore" INTEGER,
    "aiHealthSummary" TEXT,
    "aiUpsellStrategy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_settings" (
    "id" TEXT NOT NULL,
    "defaultProvider" TEXT NOT NULL DEFAULT 'anthropic',
    "leadRiskProvider" TEXT,
    "clientHealthProvider" TEXT,
    "executiveSummaryProvider" TEXT,
    "chatProvider" TEXT,
    "anthropicKeyValid" BOOLEAN NOT NULL DEFAULT false,
    "openaiKeyValid" BOOLEAN NOT NULL DEFAULT false,
    "geminiKeyValid" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
