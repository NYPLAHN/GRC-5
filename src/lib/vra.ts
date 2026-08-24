/**
 * Vendor Risk Assessment — condensed question bank & risk scoring.
 *
 * Questions are distilled from NYPL's full VRA v4.0 (May 2025); each carries
 * the source section reference so answers can be traced back to the long-form
 * questionnaire. Answers: YES (control in place), NO (absent), NA (not
 * applicable — removed from scoring).
 *
 * Risk score 0–100, higher = riskier:
 *   • Exposure (0–40): what we stand to lose — criticality, data sensitivity,
 *     user population, hosting model.
 *   • Posture gap (0–60): weighted share of security-control questions NOT
 *     answered YES (unanswered counts as a gap — unknown is risk).
 *   • SSO (−4) and enforced MFA (−4) reduce the final score.
 */

export type VraAnswer = "YES" | "NO" | "NA";

export type VraQuestion = {
  id: string;
  section: string; // VRA v4.0 section reference
  domain: string;
  text: string;
  weight: number;
};

export const VRA_QUESTIONS: VraQuestion[] = [
  { id: "VRA-01", section: "1.2.1", domain: "Personnel", text: "Background checks are performed on employees/contractors before access to sensitive data", weight: 3 },
  { id: "VRA-02", section: "2.2.1", domain: "Assurance", text: "Independent IT attestation completed (SOC 2, HiTrust, ISO 27001) for the relevant service", weight: 8 },
  { id: "VRA-03", section: "3.1.1", domain: "Info Security", text: "Documented, management-approved information security program and policy", weight: 8 },
  { id: "VRA-04", section: "3.2.1", domain: "Encryption", text: "Confidential data is encrypted in transit between client and vendor", weight: 8 },
  { id: "VRA-05", section: "3.3.1", domain: "Encryption", text: "Data at rest is encrypted (network/SAN storage, backups, portable media)", weight: 8 },
  { id: "VRA-06", section: "3.4.1", domain: "Incidents", text: "No material security incidents in the past three years (vendor or their subcontractors)", weight: 6 },
  { id: "VRA-07", section: "3.5.1", domain: "Endpoints", text: "Endpoint security and MDM controls protect devices touching scoped data", weight: 4 },
  { id: "VRA-08", section: "3.6.4", domain: "Training", text: "Security awareness training program for staff (at least annual)", weight: 3 },
  { id: "VRA-09", section: "4.1–4.5", domain: "AI/ML", text: "If AI/ML is used in the service, it is disclosed and governed (policies, human review, data handling)", weight: 3 },
  { id: "VRA-10", section: "5.1.2", domain: "Change Mgmt", text: "Documented change management with testing before production deployment", weight: 3 },
  { id: "VRA-11", section: "6.1.1", domain: "Maintenance", text: "Backups are performed, tested, and stored offsite", weight: 5 },
  { id: "VRA-12", section: "7.1.2", domain: "Access Control", text: "Management-approved access control and password policies are enforced", weight: 6 },
  { id: "VRA-13", section: "7.3.5", domain: "Access Control", text: "Two-factor authentication is supported for all remote/client access methods", weight: 8 },
  { id: "VRA-14", section: "7.4.5", domain: "Access Control", text: "Periodic access reviews of user, system, and third-party accounts", weight: 5 },
  { id: "VRA-15", section: "8.1–8.2", domain: "Network", text: "Network security program with firewalls, IDS/IPS, and hardened device standards", weight: 4 },
  { id: "VRA-16", section: "10.1.2", domain: "Cloud", text: "Cloud hosting provider supplies independent audit reports (e.g., SOC)", weight: 4 },
  { id: "VRA-17", section: "11.1–11.2", domain: "Physical", text: "Physical security controls for offices and data centers (badging, visitor management)", weight: 3 },
  { id: "VRA-18", section: "12.1.1", domain: "Continuity", text: "Business continuity / disaster recovery plan exists and is tested periodically", weight: 6 },
  { id: "VRA-19", section: "13.1–13.2", domain: "Incident Response", text: "Documented incident response plan with defined client notification timeframes", weight: 6 },
  { id: "VRA-20", section: "13.3.1", domain: "Insurance", text: "Carries cybersecurity insurance", weight: 4 },
  { id: "VRA-21", section: "15.1.2", domain: "Fourth Parties", text: "Performs due diligence on subcontractors and critical third-party providers", weight: 4 },
];

export const VRA_TOTAL_WEIGHT = VRA_QUESTIONS.reduce((s, q) => s + q.weight, 0);

// ─── Data sensitivity catalog ─────────────────────────────────
export const DATA_CATEGORIES: { label: string; points: number }[] = [
  { label: "Patron PII", points: 12 },
  { label: "Staff PII", points: 10 },
  { label: "Financial", points: 10 },
  { label: "Credentials / Auth Data", points: 10 },
  { label: "Health Data", points: 12 },
  { label: "Confidential Business Data", points: 8 },
  { label: "Internal Operational Data", points: 4 },
  { label: "Public Data Only", points: 0 },
];

export const HOSTING_OPTIONS: { value: string; label: string; points: number }[] = [
  { value: "SAAS_CLOUD", label: "SaaS / Public Cloud", points: 6 },
  { value: "VENDOR_DATACENTER", label: "Vendor Data Center", points: 5 },
  { value: "HYBRID", label: "Hybrid", points: 4 },
  { value: "ON_PREMISE", label: "On-Premise (NYPL hosted)", points: 2 },
];

export type VendorScoringInput = {
  criticality: string;
  dataProcessed: string[];
  storesNyplData: boolean;
  userCount: number | null;
  hosting: string | null;
  ssoEnabled: boolean;
  mfaEnforced: boolean;
};

export type VendorRiskBreakdown = {
  exposure: number;      // 0–40
  postureGap: number;    // 0–60
  reductions: number;    // SSO/MFA credits (negative)
  total: number;         // 0–100
  answered: number;
  applicable: number;
  gaps: { id: string; text: string; weight: number }[]; // NO/unanswered questions
};

const CRIT_POINTS: Record<string, number> = { LOW: 2, MEDIUM: 5, HIGH: 10, CRITICAL: 14 };

export function computeVendorRiskScore(
  vendor: VendorScoringInput,
  responses: { questionId: string; answer: string }[]
): VendorRiskBreakdown {
  // ── Exposure (0–40) ──
  let exposure = CRIT_POINTS[vendor.criticality] ?? 5;

  const dataPoints = vendor.dataProcessed.length
    ? Math.max(...vendor.dataProcessed.map((d) => DATA_CATEGORIES.find((c) => c.label === d)?.points ?? 6))
    : vendor.storesNyplData ? 8 : 0;
  exposure += dataPoints;

  const users = vendor.userCount ?? 0;
  exposure += users > 1000 ? 8 : users > 250 ? 6 : users > 50 ? 4 : users > 0 ? 2 : 0;

  exposure += HOSTING_OPTIONS.find((h) => h.value === vendor.hosting)?.points ?? 3;
  exposure = Math.min(40, exposure);

  // ── Posture gap (0–60) ──
  const byId = new Map(responses.map((r) => [r.questionId, r.answer]));
  let applicableWeight = 0;
  let gapWeight = 0;
  let answered = 0;
  let applicable = 0;
  const gaps: { id: string; text: string; weight: number }[] = [];

  for (const q of VRA_QUESTIONS) {
    const ans = byId.get(q.id);
    if (ans === "NA") continue;
    applicable++;
    applicableWeight += q.weight;
    if (ans === "YES") {
      answered++;
    } else {
      if (ans === "NO") answered++;
      gapWeight += q.weight;
      gaps.push({ id: q.id, text: q.text, weight: q.weight });
    }
  }
  const postureGap = applicableWeight > 0 ? Math.round((gapWeight / applicableWeight) * 60) : 30;

  // ── Reductions ──
  let reductions = 0;
  if (vendor.ssoEnabled) reductions -= 4;
  if (vendor.mfaEnforced) reductions -= 4;

  const total = Math.max(0, Math.min(100, exposure + postureGap + reductions));

  return { exposure, postureGap, reductions, total, answered, applicable, gaps };
}

export function getVendorRiskRating(score: number): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" {
  if (score >= 70) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 30) return "MEDIUM";
  return "LOW";
}

export const VRA_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "Not Started",
  SENT_TO_VENDOR: "Sent to Vendor",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  REVIEWED: "Reviewed",
};

export const VENDOR_STATUS_LABELS: Record<string, string> = {
  ONBOARDING: "Onboarding",
  ACTIVE: "Active",
  UNDER_REVIEW: "Under Review",
  OFFBOARDED: "Offboarded",
};
