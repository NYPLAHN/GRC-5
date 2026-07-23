import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow } from "date-fns";

// ─── Tailwind helper ──────────────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Date formatting ──────────────────────────────────────────
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "MMM d, yyyy");
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "MMM d, yyyy 'at' h:mm a");
}

export function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

// ─── Risk scoring ─────────────────────────────────────────────
const LIKELIHOOD_MAP: Record<string, number> = {
  RARE: 1, UNLIKELY: 2, POSSIBLE: 3, LIKELY: 4, ALMOST_CERTAIN: 5,
};
const IMPACT_MAP: Record<string, number> = {
  NEGLIGIBLE: 1, MINOR: 2, MODERATE: 3, MAJOR: 4, CRITICAL: 5,
};

export function computeRiskScore(likelihood: string, impact: string): number {
  return (LIKELIHOOD_MAP[likelihood] ?? 1) * (IMPACT_MAP[impact] ?? 1);
}

export function getRiskRating(score: number): string {
  if (score >= 15) return "CRITICAL";
  if (score >= 10) return "HIGH";
  if (score >= 5) return "MEDIUM";
  return "LOW";
}

export function getRiskBadgeClasses(rating: string): string {
  switch (rating) {
    case "CRITICAL": return "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800";
    case "HIGH": return "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800";
    case "MEDIUM": return "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800";
    case "LOW": return "bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800";
    default: return "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700";
  }
}

// ─── Control criticality & maturity ───────────────────────────
export const CRITICALITY_OPTIONS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export function getCriticalityClasses(criticality: string): string {
  switch (criticality) {
    case "CRITICAL": return "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800";
    case "HIGH": return "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800";
    case "MEDIUM": return "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800";
    case "LOW": return "bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800";
    default: return "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700";
  }
}

export const CRITICALITY_WEIGHT: Record<string, number> = {
  LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4,
};

export const MATURITY_LABELS: Record<number, string> = {
  0: "Not Performed",
  1: "Initial",
  2: "Repeatable",
  3: "Defined",
  4: "Managed",
  5: "Optimizing",
};

export function getMaturityColor(level: number): string {
  const colors = ["#dc2626", "#ea580c", "#d97706", "#eab308", "#84cc16", "#16a34a"];
  return colors[Math.max(0, Math.min(5, level))];
}

export function getMaturityClasses(level: number): string {
  if (level >= 4) return "bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800";
  if (level >= 3) return "bg-lime-100 text-lime-700 border-lime-200 dark:bg-lime-950 dark:text-lime-400 dark:border-lime-800";
  if (level >= 2) return "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800";
  if (level >= 1) return "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800";
  return "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800";
}

/**
 * Per-control risk score 0–100: criticality weight × maturity gap.
 * A CRITICAL control at maturity 0 scores 100; anything at maturity 5 scores 0.
 */
export function computeControlRiskScore(criticality: string, maturityLevel: number): number {
  const weight = CRITICALITY_WEIGHT[criticality] ?? 2;
  const gap = 5 - Math.max(0, Math.min(5, maturityLevel));
  return Math.round((weight * gap) / (4 * 5) * 100);
}

// ─── Risk source & review cadence ─────────────────────────────
export const RISK_SOURCE_LABELS: Record<string, string> = {
  NIST_CSF_REVIEW: "NIST CSF Review",
  PENETRATION_TEST: "Penetration Test",
  VULNERABILITY_SCAN: "Vulnerability Scan",
  SELF_IDENTIFIED: "Self-Identified",
  INTERNAL_AUDIT: "Internal Audit",
  EXTERNAL_AUDIT: "External Audit",
  THIRD_PARTY: "Third Party",
  INCIDENT: "Incident",
  OTHER: "Other",
};

export function getRiskSourceClasses(source: string): string {
  switch (source) {
    case "NIST_CSF_REVIEW": return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800";
    case "PENETRATION_TEST": return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800";
    case "VULNERABILITY_SCAN": return "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-800";
    case "SELF_IDENTIFIED": return "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800";
    case "INTERNAL_AUDIT": return "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800";
    case "EXTERNAL_AUDIT": return "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800";
    case "THIRD_PARTY": return "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950 dark:text-pink-300 dark:border-pink-800";
    case "INCIDENT": return "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800";
    default: return "bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700";
  }
}

export const CADENCE_LABELS: Record<string, string> = {
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  SEMI_ANNUAL: "Semi-Annual",
  ANNUAL: "Annual",
};

// ─── Likelihood / Impact pills ────────────────────────────────
export function getLikelihoodClasses(likelihood: string): string {
  const val = LIKELIHOOD_MAP[likelihood] ?? 3;
  if (val >= 5) return "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800";
  if (val >= 4) return "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800";
  if (val >= 3) return "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800";
  return "bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800";
}

export function getImpactClasses(impact: string): string {
  const val = IMPACT_MAP[impact] ?? 3;
  if (val >= 5) return "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800";
  if (val >= 4) return "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800";
  if (val >= 3) return "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800";
  return "bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800";
}

export function formatEnumLabel(value: string): string {
  return value
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

// ─── Evidence suggestions by control category ────────────────
const EVIDENCE_SUGGESTIONS: Record<string, string[]> = {
  "identity & access": ["MFA enrollment report or screenshot", "Access review sign-off (quarterly)", "IAM policy document", "Privileged account inventory export"],
  "access control": ["MFA enrollment report or screenshot", "Access review sign-off (quarterly)", "IAM policy document", "Privileged account inventory export"],
  "network security": ["Firewall ruleset export", "Network segmentation diagram", "IDS/IPS configuration screenshot", "VPN configuration policy"],
  "data protection": ["Encryption policy document", "DLP configuration report", "Data classification standard", "Key management procedure"],
  "asset management": ["Hardware/software inventory export (CMDB)", "Asset lifecycle policy", "Unauthorized asset detection report"],
  "vulnerability management": ["Vulnerability scan report (e.g. Nessus/Qualys)", "Patch compliance dashboard export", "Remediation SLA policy"],
  "incident response": ["Incident response plan (approved)", "Tabletop exercise after-action report", "Incident ticket samples", "On-call escalation roster"],
  "business continuity": ["Business continuity / DR plan", "Backup restoration test results", "RTO/RPO documentation"],
  "security awareness": ["Training completion report", "Phishing simulation results", "Awareness program curriculum"],
  "governance": ["Approved security policy or charter", "Risk committee meeting minutes", "Roles & responsibilities (RACI) chart"],
  "logging & monitoring": ["SIEM dashboard screenshot", "Log retention configuration", "Alert runbook document"],
  "third party": ["Vendor risk assessment questionnaire", "SOC 2 report from vendor", "Contract security addendum"],
};

export function getEvidenceSuggestions(category: string | null): string[] {
  const key = (category ?? "").toLowerCase();
  for (const [cat, suggestions] of Object.entries(EVIDENCE_SUGGESTIONS)) {
    if (key.includes(cat) || cat.includes(key)) return suggestions;
  }
  return [
    "Approved policy or standard document (PDF)",
    "Configuration screenshot or system export",
    "Framework/architecture diagram",
    "Audit report or assessment excerpt",
    "Process runbook or procedure document",
  ];
}

// ─── CSV export helpers (client-side) ─────────────────────────
export function toCsv(rows: Record<string, unknown>[], columns: { key: string; label: string }[]): string {
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => escape(c.label)).join(",");
  const body = rows.map((row) => columns.map((c) => escape(row[c.key])).join(",")).join("\n");
  return `${header}\n${body}`;
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Compliance scoring ───────────────────────────────────────
export function computeComplianceScore(
  compliant: number,
  partial: number,
  total: number
): number {
  if (total === 0) return 0;
  const weightedScore = compliant * 1.0 + partial * 0.5;
  return Math.round((weightedScore / total) * 100);
}

export function getComplianceBadgeClasses(status: string): string {
  switch (status) {
    case "COMPLIANT": return "bg-green-100 text-green-700 border-green-200";
    case "PARTIAL": return "bg-yellow-100 text-yellow-700 border-yellow-200";
    case "NON_COMPLIANT": return "bg-red-100 text-red-700 border-red-200";
    case "NOT_APPLICABLE": return "bg-gray-100 text-gray-500 border-gray-200";
    default: return "bg-gray-100 text-gray-500 border-gray-200";
  }
}

export function formatComplianceStatus(status: string): string {
  const map: Record<string, string> = {
    COMPLIANT: "Compliant",
    PARTIAL: "Partial",
    NON_COMPLIANT: "Non-Compliant",
    NOT_APPLICABLE: "N/A",
  };
  return map[status] ?? status;
}

// ─── Control status helpers ───────────────────────────────────
export function getControlStatusClasses(status: string): string {
  switch (status) {
    case "IMPLEMENTED": return "bg-green-100 text-green-700 border-green-200";
    case "IN_PROGRESS": return "bg-blue-100 text-blue-700 border-blue-200";
    case "NOT_STARTED": return "bg-gray-100 text-gray-600 border-gray-200";
    case "NOT_APPLICABLE": return "bg-gray-50 text-gray-400 border-gray-100";
    default: return "bg-gray-100 text-gray-600 border-gray-200";
  }
}

export function formatControlStatus(status: string): string {
  const map: Record<string, string> = {
    IMPLEMENTED: "Implemented",
    IN_PROGRESS: "In Progress",
    NOT_STARTED: "Not Started",
    NOT_APPLICABLE: "N/A",
  };
  return map[status] ?? status;
}

// ─── Misc ─────────────────────────────────────────────────────
export function truncate(str: string, maxLen = 80): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function generateId(prefix: string, existingIds: string[]): string {
  const maxNum = existingIds
    .map((id) => parseInt(id.replace(`${prefix}-`, ""), 10))
    .filter((n) => !isNaN(n))
    .reduce((max, n) => Math.max(max, n), 0);
  return `${prefix}-${String(maxNum + 1).padStart(3, "0")}`;
}
