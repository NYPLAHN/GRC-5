# GRC Platform

A single-tenant, full-stack Governance, Risk & Compliance platform built on Next.js 14, Prisma, PostgreSQL, and Clerk. Implements a **"map once, comply many"** approach — every internal control maps to multiple framework requirements, so a single assessment drives compliance scores across NIST CSF 2.0 and CIS Controls v8.1 simultaneously.

---

## Features

| Module | Capability |
|---|---|
| **Executive Dashboard** | Compliance gauges, risk heatmap, remediation burn-down chart |
| **Controls Library** | Cross-framework mapping viewer (NIST CSF 2.0 ↔ CIS v8.1) |
| **Risk Register** | Full CRUD with inherent/residual scoring (Likelihood × Impact), velocity, treatment plans |
| **Assessments** | Bulk CSV/JSON import, per-control compliance status tracking |
| **Evidence Locker** | File artifact storage with version history, control tagging, expiry alerts |
| **Remediation Tracker** | Priority-managed remediation queue with Jira integration |
| **Reporting** | Cross-framework gap analysis, top unmitigated risks, compliance trends |
| **Auth / SSO** | Clerk-powered SAML 2.0 / OIDC with 3-tier RBAC (Admin / Contributor / Viewer) |
| **Jira Integration** | POST to Jira REST API on remediation creation; inbound webhook receiver for status sync |

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Backend | Next.js API Routes |
| ORM | Prisma |
| Database | PostgreSQL |
| Auth | Clerk (SAML / OIDC / MFA) |
| Type safety | TypeScript + Zod |

---

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ (local or hosted — [Neon](https://neon.tech), [Supabase](https://supabase.com), or AWS RDS)
- A [Clerk](https://clerk.com) account (free tier works)

### 1. Clone & Install

```bash
git clone <your-repo-url> grc-platform
cd grc-platform
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Your PostgreSQL connection string |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | [Clerk Dashboard](https://dashboard.clerk.com) → API Keys |
| `CLERK_SECRET_KEY` | Same as above |
| `JIRA_BASE_URL` | Your Jira Cloud URL, e.g. `https://your-org.atlassian.net` |
| `JIRA_API_TOKEN` | [Atlassian API Tokens](https://id.atlassian.com/manage-profile/security/api-tokens) |
| `JIRA_USER_EMAIL` | Email associated with the API token |
| `JIRA_PROJECT_KEY` | Jira project key (e.g. `GRC`, `SEC`) |

### 3. Set Up Database

```bash
# Push schema to database
npm run db:push

# Seed NIST CSF 2.0 + CIS v8.1 framework data and sample risks
npm run db:seed
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll be redirected to Clerk's sign-in page.

### 5. Set Your User Role

After signing in for the first time, open Prisma Studio to set your role to `ADMIN`:

```bash
npm run db:studio
```

Navigate to the `User` table, find your record, and set `role` to `ADMIN`. Then refresh the app.

---

## Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel deploy --prod
```

Set all environment variables in the Vercel dashboard under **Settings → Environment Variables**.

Add `DATABASE_URL` pointing to a hosted PostgreSQL instance (Neon or Supabase recommended for serverless).

### Database Migration (Production)

```bash
npx prisma migrate deploy
npm run db:seed
```

---

## Jira Integration

### Outbound (GRC → Jira)

When creating a remediation, check **"Create Jira Issue"** to automatically POST a Task to your Jira project.

The integration uses Jira's REST API v3. Each issue is created with:
- Summary: `[GRC-{controlCode}] {title}`
- Priority mapped from GRC priority (1=Highest → 4=Low)
- Labels: `grc-platform`, `control-{code}`
- GRC Remediation ID in the description body

### Inbound (Jira → GRC)

Configure a webhook in Jira to sync status changes back to GRC:

1. In Jira: **Project Settings → Automation → Webhooks**
2. URL: `https://your-grc-domain.com/api/integrations/jira`
3. Header: `x-grc-webhook-secret: <your INTERNAL_API_SECRET>`
4. Events: `Issue updated` (status changed)

---

## RBAC Roles

| Role | Permissions |
|---|---|
| **Admin** | Full system access, user management, settings, integrations |
| **Contributor** | Create/edit risks, assessments, evidence, remediations |
| **Viewer** | Read-only access to all modules and reports |

Roles are stored in the `User` table and can be managed via Prisma Studio or a future Admin UI (`/admin/users`).

---

## Framework Data

The seed script (`prisma/seed.ts`) pre-populates:

- **NIST CSF 2.0** — 38 requirements across all 6 functions (GOVERN, IDENTIFY, PROTECT, DETECT, RESPOND, RECOVER)
- **CIS Controls v8.1** — 27 safeguards across IG1 and IG2 implementation groups
- **14 internal controls** with cross-framework mappings covering Identity & Access, Asset Management, Vulnerability Management, Data Protection, SIEM, Incident Response, Backup/DR, Configuration Management, and Governance
- **6 sample risks** representing common cybersecurity scenarios

---

## Project Structure

```
src/
├── app/
│   ├── api/                    # REST API route handlers
│   │   ├── controls/           # Internal controls CRUD
│   │   ├── risks/              # Risk register CRUD
│   │   ├── assessments/        # Assessment + bulk import
│   │   ├── evidence/           # Evidence locker
│   │   ├── remediation/        # Remediation tracker + Jira push
│   │   ├── frameworks/         # Framework listing
│   │   ├── dashboard/          # Aggregated dashboard data
│   │   └── integrations/jira/  # Jira inbound webhook receiver
│   ├── dashboard/              # Executive dashboard page
│   ├── controls/               # Controls library + detail view
│   ├── risks/                  # Risk register (client-side with drawer)
│   ├── assessments/            # Assessment list + bulk CSV import
│   ├── evidence/               # Evidence locker with expiry tracking
│   ├── remediation/            # Remediation tracker with Jira toggle
│   └── reports/                # Gap analysis + executive reporting
├── components/
│   ├── layout/                 # Sidebar + Header
│   └── dashboard/              # ComplianceGauge, RiskHeatmap, RemediationBurndown, StatsCard
├── lib/
│   ├── prisma.ts               # Singleton Prisma client
│   ├── auth.ts                 # Clerk session helpers
│   ├── rbac.ts                 # Role-based access control
│   ├── jira.ts                 # Jira REST API client
│   └── utils.ts                # Shared utilities (scoring, formatting)
├── types/
│   └── index.ts                # Shared TypeScript types
└── middleware.ts               # Clerk auth middleware
prisma/
├── schema.prisma               # Full database schema
└── seed.ts                     # Framework data + sample seed
```

---

## Answering the GRC Leadership Questions

| Question | Where to find it |
|---|---|
| "What is our most critical unmitigated risk today?" | **Dashboard** → Critical Open Risks panel (sorted by inherent score) |
| "If we are 80% compliant with NIST, what is our PCI/CIS gap?" | **Reports** → Cross-Framework Gap Analysis |
| "Who owns the remediation for the failed firewall audit?" | **Remediation** → filter by control, see Assignee column |
| "Can we see the evidence for this control from six months ago?" | **Controls** → select a control → Evidence History (versioned, with upload dates) |

---

## License

MIT — use freely, fork freely.
# GRC-5
# GRC-5
