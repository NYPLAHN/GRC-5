-- ─────────────────────────────────────────────────────────────
--  GRC Platform – Initial database schema
--  Equivalent to: prisma db push (single-shot, idempotent-ish)
--  Run once against your Neon database (SQL Editor or psql)
-- ─────────────────────────────────────────────────────────────

-- ─── Enums ───────────────────────────────────────────────────
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'CONTRIBUTOR', 'VIEWER');
CREATE TYPE "FrameworkSlug" AS ENUM ('NIST_CSF_2', 'CIS_V8_1', 'PCI_DSS_4', 'ISO_27001_2022');
CREATE TYPE "ControlStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'IMPLEMENTED', 'NOT_APPLICABLE');
CREATE TYPE "ComplianceStatus" AS ENUM ('COMPLIANT', 'PARTIAL', 'NON_COMPLIANT', 'NOT_APPLICABLE');
CREATE TYPE "RiskLikelihood" AS ENUM ('RARE', 'UNLIKELY', 'POSSIBLE', 'LIKELY', 'ALMOST_CERTAIN');
CREATE TYPE "RiskImpact" AS ENUM ('NEGLIGIBLE', 'MINOR', 'MODERATE', 'MAJOR', 'CRITICAL');
CREATE TYPE "RiskVelocity" AS ENUM ('SLOW', 'MEDIUM', 'FAST');
CREATE TYPE "RiskTreatment" AS ENUM ('MITIGATE', 'TRANSFER', 'ACCEPT', 'AVOID');
CREATE TYPE "RemediationStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'WONT_FIX');
CREATE TYPE "EvidenceType" AS ENUM ('PDF', 'IMAGE', 'CSV', 'JSON', 'OTHER');

-- ─── User ────────────────────────────────────────────────────
CREATE TABLE "User" (
    "id"        TEXT NOT NULL,
    "clerkId"   TEXT NOT NULL,
    "email"     TEXT NOT NULL,
    "name"      TEXT,
    "role"      "UserRole" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");
CREATE UNIQUE INDEX "User_email_key"   ON "User"("email");

-- ─── Framework ───────────────────────────────────────────────
CREATE TABLE "Framework" (
    "id"          TEXT NOT NULL,
    "slug"        "FrameworkSlug" NOT NULL,
    "name"        TEXT NOT NULL,
    "version"     TEXT NOT NULL,
    "description" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Framework_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Framework_slug_key" ON "Framework"("slug");

-- ─── FrameworkRequirement ────────────────────────────────────
CREATE TABLE "FrameworkRequirement" (
    "id"          TEXT NOT NULL,
    "frameworkId" TEXT NOT NULL,
    "controlId"   TEXT NOT NULL,
    "category"    TEXT NOT NULL,
    "subCategory" TEXT,
    "title"       TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "guidance"    TEXT,
    "weight"      INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "FrameworkRequirement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FrameworkRequirement_frameworkId_idx" ON "FrameworkRequirement"("frameworkId");
CREATE INDEX "FrameworkRequirement_controlId_idx"   ON "FrameworkRequirement"("controlId");

-- ─── InternalControl ─────────────────────────────────────────
CREATE TABLE "InternalControl" (
    "id"          TEXT NOT NULL,
    "controlCode" TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status"      "ControlStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "owner"       TEXT,
    "category"    TEXT,
    "tags"        TEXT[],
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InternalControl_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InternalControl_controlCode_key" ON "InternalControl"("controlCode");

-- ─── ControlFrameworkMapping ─────────────────────────────────
CREATE TABLE "ControlFrameworkMapping" (
    "id"            TEXT NOT NULL,
    "controlId"     TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "notes"         TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ControlFrameworkMapping_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ControlFrameworkMapping_controlId_requirementId_key"
    ON "ControlFrameworkMapping"("controlId", "requirementId");
CREATE INDEX "ControlFrameworkMapping_controlId_idx"     ON "ControlFrameworkMapping"("controlId");
CREATE INDEX "ControlFrameworkMapping_requirementId_idx" ON "ControlFrameworkMapping"("requirementId");

-- ─── Risk ────────────────────────────────────────────────────
CREATE TABLE "Risk" (
    "id"               TEXT NOT NULL,
    "riskId"           TEXT NOT NULL,
    "title"            TEXT NOT NULL,
    "description"      TEXT NOT NULL,
    "category"         TEXT,
    "owner"            TEXT,
    "likelihood"       "RiskLikelihood" NOT NULL,
    "impact"           "RiskImpact" NOT NULL,
    "velocity"         "RiskVelocity" NOT NULL,
    "inherentScore"    INTEGER NOT NULL,
    "residualScore"    INTEGER NOT NULL,
    "treatment"        "RiskTreatment" NOT NULL,
    "treatmentDetails" TEXT,
    "reviewDate"       TIMESTAMP(3),
    "isOpen"           BOOLEAN NOT NULL DEFAULT true,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,
    "relatedControls"  TEXT[],
    CONSTRAINT "Risk_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Risk_riskId_key" ON "Risk"("riskId");

-- ─── Assessment ──────────────────────────────────────────────
CREATE TABLE "Assessment" (
    "id"          TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "frameworkId" TEXT NOT NULL,
    "conductedBy" TEXT NOT NULL,
    "startDate"   TIMESTAMP(3) NOT NULL,
    "endDate"     TIMESTAMP(3),
    "notes"       TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- ─── AssessmentResult ────────────────────────────────────────
CREATE TABLE "AssessmentResult" (
    "id"            TEXT NOT NULL,
    "assessmentId"  TEXT NOT NULL,
    "controlId"     TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "status"        "ComplianceStatus" NOT NULL,
    "score"         INTEGER,
    "notes"         TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AssessmentResult_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AssessmentResult_assessmentId_idx" ON "AssessmentResult"("assessmentId");
CREATE INDEX "AssessmentResult_controlId_idx"    ON "AssessmentResult"("controlId");

-- ─── Evidence ────────────────────────────────────────────────
CREATE TABLE "Evidence" (
    "id"                 TEXT NOT NULL,
    "title"              TEXT NOT NULL,
    "description"        TEXT,
    "fileName"           TEXT NOT NULL,
    "fileSize"           INTEGER NOT NULL,
    "fileType"           "EvidenceType" NOT NULL,
    "storageKey"         TEXT NOT NULL,
    "uploadedBy"         TEXT NOT NULL,
    "controlId"          TEXT,
    "riskId"             TEXT,
    "assessmentResultId" TEXT,
    "collectedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt"          TIMESTAMP(3),
    "version"            INTEGER NOT NULL DEFAULT 1,
    "tags"               TEXT[],
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Evidence_controlId_idx" ON "Evidence"("controlId");
CREATE INDEX "Evidence_riskId_idx"    ON "Evidence"("riskId");

-- ─── Remediation ─────────────────────────────────────────────
CREATE TABLE "Remediation" (
    "id"           TEXT NOT NULL,
    "title"        TEXT NOT NULL,
    "description"  TEXT NOT NULL,
    "controlId"    TEXT NOT NULL,
    "assignedTo"   TEXT NOT NULL,
    "status"       "RemediationStatus" NOT NULL DEFAULT 'OPEN',
    "priority"     INTEGER NOT NULL DEFAULT 2,
    "dueDate"      TIMESTAMP(3),
    "resolvedAt"   TIMESTAMP(3),
    "jiraIssueKey" TEXT,
    "jiraIssueUrl" TEXT,
    "jiraSyncedAt" TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Remediation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Remediation_controlId_idx" ON "Remediation"("controlId");
CREATE INDEX "Remediation_status_idx"    ON "Remediation"("status");

-- ─── AuditLog ────────────────────────────────────────────────
CREATE TABLE "AuditLog" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "action"     TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId"   TEXT NOT NULL,
    "changes"    JSONB,
    "ipAddress"  TEXT,
    "userAgent"  TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditLog_userId_idx"                ON "AuditLog"("userId");
CREATE INDEX "AuditLog_entityType_entityId_idx"   ON "AuditLog"("entityType", "entityId");
CREATE INDEX "AuditLog_createdAt_idx"             ON "AuditLog"("createdAt");

-- ─── Foreign Keys ────────────────────────────────────────────
ALTER TABLE "FrameworkRequirement"
    ADD CONSTRAINT "FrameworkRequirement_frameworkId_fkey"
    FOREIGN KEY ("frameworkId") REFERENCES "Framework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ControlFrameworkMapping"
    ADD CONSTRAINT "ControlFrameworkMapping_controlId_fkey"
    FOREIGN KEY ("controlId") REFERENCES "InternalControl"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ControlFrameworkMapping"
    ADD CONSTRAINT "ControlFrameworkMapping_requirementId_fkey"
    FOREIGN KEY ("requirementId") REFERENCES "FrameworkRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Assessment"
    ADD CONSTRAINT "Assessment_frameworkId_fkey"
    FOREIGN KEY ("frameworkId") REFERENCES "Framework"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Assessment"
    ADD CONSTRAINT "Assessment_conductedBy_fkey"
    FOREIGN KEY ("conductedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AssessmentResult"
    ADD CONSTRAINT "AssessmentResult_assessmentId_fkey"
    FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AssessmentResult"
    ADD CONSTRAINT "AssessmentResult_controlId_fkey"
    FOREIGN KEY ("controlId") REFERENCES "InternalControl"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AssessmentResult"
    ADD CONSTRAINT "AssessmentResult_requirementId_fkey"
    FOREIGN KEY ("requirementId") REFERENCES "FrameworkRequirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Evidence"
    ADD CONSTRAINT "Evidence_uploadedBy_fkey"
    FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Evidence"
    ADD CONSTRAINT "Evidence_controlId_fkey"
    FOREIGN KEY ("controlId") REFERENCES "InternalControl"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Evidence"
    ADD CONSTRAINT "Evidence_riskId_fkey"
    FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Evidence"
    ADD CONSTRAINT "Evidence_assessmentResultId_fkey"
    FOREIGN KEY ("assessmentResultId") REFERENCES "AssessmentResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Remediation"
    ADD CONSTRAINT "Remediation_controlId_fkey"
    FOREIGN KEY ("controlId") REFERENCES "InternalControl"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Remediation"
    ADD CONSTRAINT "Remediation_assignedTo_fkey"
    FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AuditLog"
    ADD CONSTRAINT "AuditLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
