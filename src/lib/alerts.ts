/**
 * Shared "needs attention" aggregation — used by the notification
 * bell (/api/alerts) and the outbound Slack digest.
 */
import { prisma } from "@/lib/prisma";

export type AlertItem = {
  id: string;
  type:
    | "OVERDUE_REMEDIATION"
    | "EXPIRED_EVIDENCE"
    | "EXPIRING_EVIDENCE"
    | "EXCEPTION_REVIEW"
    | "CRITICAL_RISK"
    | "POLICY_REVIEW"
    | "VENDOR_REVIEW";
  title: string;
  detail: string;
  href: string;
};

const fmt = (d: Date | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";

export async function gatherAlerts(): Promise<AlertItem[]> {
  const now = new Date();
  const in30days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const [overdueRems, expiredEvidence, expiringEvidence, overdueExceptions, criticalRisks, overduePolicies, overdueVendors] = await Promise.all([
    prisma.remediation.findMany({
      where: { dueDate: { lt: now }, status: { in: ["OPEN", "IN_PROGRESS"] } },
      select: { id: true, title: true, dueDate: true },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
    prisma.evidence.findMany({
      where: { expiresAt: { lt: now } },
      select: { id: true, title: true, expiresAt: true },
      orderBy: { expiresAt: "asc" },
      take: 10,
    }),
    prisma.evidence.findMany({
      where: { expiresAt: { gte: now, lte: in30days } },
      select: { id: true, title: true, expiresAt: true },
      orderBy: { expiresAt: "asc" },
      take: 10,
    }),
    prisma.risk.findMany({
      where: { isException: true, exceptionNextReview: { lt: now } },
      select: { id: true, riskId: true, title: true, exceptionNextReview: true },
      take: 10,
    }),
    prisma.risk.findMany({
      where: { isOpen: true, inherentScore: { gte: 15 } },
      select: { id: true, riskId: true, title: true, inherentScore: true },
      orderBy: { inherentScore: "desc" },
      take: 10,
    }),
    prisma.policy.findMany({
      where: { status: { not: "RETIRED" }, nextReviewDate: { lt: now } },
      select: { id: true, policyCode: true, name: true, nextReviewDate: true },
      orderBy: { nextReviewDate: "asc" },
      take: 10,
    }).catch(() => [] as { id: string; policyCode: string; name: string; nextReviewDate: Date | null }[]),
    prisma.vendor.findMany({
      where: { status: { not: "OFFBOARDED" }, nextReviewDate: { lt: now } },
      select: { id: true, vendorCode: true, name: true, nextReviewDate: true },
      orderBy: { nextReviewDate: "asc" },
      take: 10,
    }).catch(() => [] as { id: string; vendorCode: string; name: string; nextReviewDate: Date | null }[]),
  ]);

  return [
    ...overdueRems.map((r) => ({
      id: `rem-${r.id}`,
      type: "OVERDUE_REMEDIATION" as const,
      title: r.title,
      detail: `Remediation overdue — was due ${fmt(r.dueDate)}`,
      href: "/remediation",
    })),
    ...overdueVendors.map((v) => ({
      id: `ven-${v.id}`,
      type: "VENDOR_REVIEW" as const,
      title: `${v.vendorCode} · ${v.name}`,
      detail: `Vendor review overdue — was due ${fmt(v.nextReviewDate)}`,
      href: "/vendors",
    })),
    ...overduePolicies.map((p) => ({
      id: `pol-${p.id}`,
      type: "POLICY_REVIEW" as const,
      title: `${p.policyCode} · ${p.name}`,
      detail: `Policy review overdue — was due ${fmt(p.nextReviewDate)}`,
      href: "/policies",
    })),
    ...overdueExceptions.map((r) => ({
      id: `exc-${r.id}`,
      type: "EXCEPTION_REVIEW" as const,
      title: `${r.riskId} · ${r.title}`,
      detail: `Exception review overdue — was due ${fmt(r.exceptionNextReview)}`,
      href: "/risks",
    })),
    ...expiredEvidence.map((e) => ({
      id: `eve-${e.id}`,
      type: "EXPIRED_EVIDENCE" as const,
      title: e.title,
      detail: `Evidence expired ${fmt(e.expiresAt)}`,
      href: "/evidence",
    })),
    ...expiringEvidence.map((e) => ({
      id: `evs-${e.id}`,
      type: "EXPIRING_EVIDENCE" as const,
      title: e.title,
      detail: `Evidence expires ${fmt(e.expiresAt)}`,
      href: "/evidence",
    })),
    ...criticalRisks.map((r) => ({
      id: `crit-${r.id}`,
      type: "CRITICAL_RISK" as const,
      title: `${r.riskId} · ${r.title}`,
      detail: `Critical open risk — inherent score ${r.inherentScore}`,
      href: "/risks",
    })),
  ];
}
