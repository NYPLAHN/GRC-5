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
    case "CRITICAL": return "bg-red-100 text-red-700 border-red-200";
    case "HIGH": return "bg-orange-100 text-orange-700 border-orange-200";
    case "MEDIUM": return "bg-yellow-100 text-yellow-700 border-yellow-200";
    case "LOW": return "bg-green-100 text-green-700 border-green-200";
    default: return "bg-gray-100 text-gray-700 border-gray-200";
  }
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
