# GRC Platform Roadmap — Feature Recommendations

Ideas drawn from what industry leaders (Vanta, Drata, ServiceNow IRM, Archer, OneTrust, Hyperproof, AuditBoard) do well, prioritized for a lean internal platform. The data model already supports several of these with little extra work.

## Near term (high value, low effort)

**Continuous control monitoring (the Vanta/Drata differentiator).** Instead of point-in-time evidence, connect read-only APIs (Okta/Azure AD for MFA coverage, Jamf/Intune for device encryption, AWS/GCP config, CrowdStrike) and auto-test controls daily. Start with one integration — e.g. an Okta MFA check that flips IC-00x evidence to "verified today." Evidence freshness tracking already exists; this automates it.

**Evidence auto-expiry policies per control.** Set a default review period by control criticality (e.g. CRITICAL controls need evidence < 90 days old). The dashboard flags stale evidence automatically. Schema already has `expiresAt` — add a per-control default.

**Notifications & digests.** Weekly email/Slack digest: overdue remediations, exceptions due for review, expiring evidence, new critical risks. A simple cron + one Slack webhook covers 80% of the value. (Exceptions with review cadences are now tracked — this makes the cadence actually enforce itself.)

**Real file storage.** Uploads currently store metadata only. Wire `storageKey` to S3/Backblaze/Supabase storage with presigned URLs so artifacts are actually retrievable in an audit.

**Audit log viewer.** The `AuditLog` table is already populated on every write — add a read-only Admin page with filters. Auditors love this, and it's nearly free.

**Trend history.** Snapshot compliance score, control risk score, and open-risk counts weekly (one small table) and chart posture over time on the dashboard. Point-in-time dashboards can't answer "are we improving?" — the #1 board question.

## Medium term

**Assessment workflow in-app.** Beyond CSV import: assign requirements to owners, let them self-attest with evidence attached, track completion %, then lock the assessment. This is Archer/AuditBoard's core loop.

**Policy management module.** Store policies as first-class objects (owner, version, review date, approval workflow, employee acknowledgment tracking). Map policies → controls, closing the loop: policy → control → evidence → framework.

**Vendor/third-party risk (TPRM).** A vendor register with tiering, security questionnaires, SOC 2 report tracking, and renewal dates. You already track THIRD_PARTY as a risk source — this makes it a workflow.

**Risk quantification option.** Alongside the 5×5 matrix, add optional FAIR-style annualized loss expectancy (probability × impact in dollars) for the top 10 risks. Executives respond to dollar figures.

**Framework cross-walk expansion.** The map-once-comply-many model is your best asset. Add ISO 27001:2022 and PCI DSS 4.0 requirement seeds and auto-suggest mappings based on existing NIST/CIS links.

**SLA engine for remediation.** Auto-set due dates from priority (Critical = 30 days, High = 60...), track SLA breach rates, and show them on the executive report.

## Longer term / future proofing

**Two-way Jira sync.** Webhooks so Jira status changes update remediation status automatically (currently one-way push).

**AI assist.** Draft risk descriptions and treatment plans from assessment findings; summarize uploaded evidence PDFs and check them against the control's "suggested evidence" list; natural-language querying ("show controls with no evidence newer than 6 months").

**RBAC hardening + SSO groups.** Map Clerk/Okta groups to roles automatically; add an approver role for exceptions (exception approval should be someone other than the requester).

**Multi-entity support.** If NYPL ever needs per-branch or per-department scoping, add an `orgUnit` dimension to controls/risks early — retrofitting tenancy is painful.

**Public trust page.** Vanta/Drata-style read-only status page showing framework scores and control coverage for internal stakeholders.

## Quick wins already wired into the codebase

- `npm run db:backfill` — estimates control maturity from implementation status so the new dashboard posture visual is meaningful day one.
- Exceptions with overdue-review flags surface automatically on the Risk Register and Executive Report.
- Unmapped evidence is flagged in the Evidence Locker so nothing gets orphaned.
