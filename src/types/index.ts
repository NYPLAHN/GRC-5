// ─── GRC Platform – Shared TypeScript Types ──────────────────────────────────

export type UserRole = "ADMIN" | "CONTRIBUTOR" | "VIEWER";

export type FrameworkSlug = "NIST_CSF_2" | "CIS_V8_1" | "PCI_DSS_4" | "ISO_27001_2022";

export type ControlStatus = "NOT_STARTED" | "IN_PROGRESS" | "IMPLEMENTED" | "NOT_APPLICABLE";

export type ComplianceStatus = "COMPLIANT" | "PARTIAL" | "NON_COMPLIANT" | "NOT_APPLICABLE";

export type RiskLikelihood = "RARE" | "UNLIKELY" | "POSSIBLE" | "LIKELY" | "ALMOST_CERTAIN";

export type RiskImpact = "NEGLIGIBLE" | "MINOR" | "MODERATE" | "MAJOR" | "CRITICAL";

export type RiskVelocity = "SLOW" | "MEDIUM" | "FAST";

export type RiskTreatment = "MITIGATE" | "TRANSFER" | "ACCEPT" | "AVOID";

export type RemediationStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "WONT_FIX";

export type EvidenceType = "PDF" | "IMAGE" | "CSV" | "JSON" | "OTHER";

// ─── Scoring helpers ──────────────────────────────────────────────────────────

export const LIKELIHOOD_VALUES: Record<RiskLikelihood, number> = {
  RARE: 1,
  UNLIKELY: 2,
  POSSIBLE: 3,
  LIKELY: 4,
  ALMOST_CERTAIN: 5,
};

export const IMPACT_VALUES: Record<RiskImpact, number> = {
  NEGLIGIBLE: 1,
  MINOR: 2,
  MODERATE: 3,
  MAJOR: 4,
  CRITICAL: 5,
};

export const VELOCITY_MULTIPLIER: Record<RiskVelocity, number> = {
  SLOW: 1.0,
  MEDIUM: 1.2,
  FAST: 1.5,
};

export function computeInherentScore(
  likelihood: RiskLikelihood,
  impact: RiskImpact,
): number {
  return LIKELIHOOD_VALUES[likelihood] * IMPACT_VALUES[impact];
}

export function getRiskRating(score: number): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" {
  if (score >= 15) return "CRITICAL";
  if (score >= 10) return "HIGH";
  if (score >= 5) return "MEDIUM";
  return "LOW";
}

export function getRiskColor(rating: string): string {
  switch (rating) {
    case "CRITICAL": return "#dc2626";
    case "HIGH": return "#ea580c";
    case "MEDIUM": return "#d97706";
    case "LOW": return "#16a34a";
    default: return "#6b7280";
  }
}

// ─── API Response shapes ──────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ─── Dashboard types ──────────────────────────────────────────────────────────

export interface ComplianceSummary {
  framework: string;
  slug: FrameworkSlug;
  totalRequirements: number;
  compliant: number;
  partial: number;
  nonCompliant: number;
  notApplicable: number;
  score: number; // 0-100
}

export interface RiskSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  open: number;
  mitigated: number;
}

export interface RemediationSummary {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  overdue: number;
  burndownData: { date: string; open: number; resolved: number }[];
}

// ─── Jira integration types ───────────────────────────────────────────────────

export interface JiraIssuePayload {
  projectKey: string;
  summary: string;
  description: string;
  issueType: "Task" | "Bug" | "Story";
  priority: "Highest" | "High" | "Medium" | "Low" | "Lowest";
  labels?: string[];
  dueDate?: string; // ISO date string
  assignee?: string; // Jira account ID
}

export interface JiraIssueResponse {
  id: string;
  key: string;
  self: string;
}

// ─── CSV/JSON Assessment import types ────────────────────────────────────────

export interface AssessmentImportRow {
  controlCode: string;
  requirementId?: string;
  status: ComplianceStatus;
  score?: number;
  notes?: string;
}
