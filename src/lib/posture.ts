/**
 * Posture metrics & daily trend snapshots.
 *
 * One snapshot per calendar day, captured lazily on dashboard load
 * (and available via POST /api/snapshots for external schedulers) —
 * no cron dependency in development.
 */
import { prisma } from "@/lib/prisma";
import { computeControlRiskScore } from "@/lib/utils";

export type PostureMetrics = {
  complianceScore: number | null;
  controlRiskScore: number | null;
  avgMaturity: number | null;
  controlsImplemented: number;
  controlsTotal: number;
  risksOpen: number;
  risksCritical: number;
  exceptionsActive: number;
  remediationsOpen: number;
  remediationsOverdue: number;
  vendorRiskAvg: number | null;
  policiesOverdue: number;
};

export async function computePostureMetrics(): Promise<PostureMetrics> {
  const now = new Date();

  const [controls, risks, remediations, frameworks, vendors, policiesOverdue] = await Promise.all([
    prisma.internalControl.findMany({
      select: { status: true, criticality: true, maturityLevel: true },
    }),
    prisma.risk.findMany({
      select: { isOpen: true, inherentScore: true, isException: true },
    }),
    prisma.remediation.findMany({
      select: { status: true, dueDate: true },
    }),
    prisma.framework.findMany({
      where: { slug: "NIST_CSF_2" },
      include: {
        requirements: {
          include: {
            assessmentResults: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { status: true },
            },
          },
        },
      },
    }),
    prisma.vendor.findMany({
      where: { status: { not: "OFFBOARDED" } },
      select: { riskScore: true },
    }).catch(() => [] as { riskScore: number | null }[]),
    prisma.policy.count({
      where: { status: { not: "RETIRED" }, nextReviewDate: { lt: now } },
    }).catch(() => 0),
  ]);

  // Compliance (matches dashboard: NIST CSF, compliant + 0.5×partial over total)
  const reqs = frameworks.flatMap((fw) => fw.requirements);
  let complianceScore: number | null = null;
  if (reqs.length > 0) {
    const compliant = reqs.filter((r) => r.assessmentResults[0]?.status === "COMPLIANT").length;
    const partial = reqs.filter((r) => r.assessmentResults[0]?.status === "PARTIAL").length;
    complianceScore = Math.round(((compliant + partial * 0.5) / reqs.length) * 100);
  }

  // Control posture
  const active = controls.filter((c) => c.status !== "NOT_APPLICABLE");
  const controlRiskScore = active.length > 0
    ? Math.round(active.reduce((s, c) => s + computeControlRiskScore(c.criticality as string, c.maturityLevel), 0) / active.length)
    : null;
  const avgMaturity = active.length > 0
    ? Math.round((active.reduce((s, c) => s + c.maturityLevel, 0) / active.length) * 10) / 10
    : null;

  const openRems = remediations.filter((r) => r.status === "OPEN" || r.status === "IN_PROGRESS");
  const scoredVendors = vendors.filter((v) => v.riskScore !== null);

  return {
    complianceScore,
    controlRiskScore,
    avgMaturity,
    controlsImplemented: controls.filter((c) => c.status === "IMPLEMENTED").length,
    controlsTotal: controls.length,
    risksOpen: risks.filter((r) => r.isOpen).length,
    risksCritical: risks.filter((r) => r.isOpen && r.inherentScore >= 15).length,
    exceptionsActive: risks.filter((r) => r.isException).length,
    remediationsOpen: openRems.length,
    remediationsOverdue: openRems.filter((r) => r.dueDate && new Date(r.dueDate) < now).length,
    vendorRiskAvg: scoredVendors.length > 0
      ? Math.round(scoredVendors.reduce((s, v) => s + (v.riskScore ?? 0), 0) / scoredVendors.length)
      : null,
    policiesOverdue,
  };
}

/** Capture today's snapshot if it doesn't exist yet (idempotent, race-safe). */
export async function capturePostureSnapshot() {
  const snapshotDate = new Date().toISOString().slice(0, 10);
  try {
    const existing = await prisma.postureSnapshot.findUnique({ where: { snapshotDate } });
    if (existing) return existing;
    const metrics = await computePostureMetrics();
    return await prisma.postureSnapshot.upsert({
      where: { snapshotDate },
      update: {},
      create: { snapshotDate, ...metrics },
    });
  } catch {
    // Table may not exist yet (pre-db:push) — never break the caller.
    return null;
  }
}

/** Recent snapshots, oldest first, for charting. */
export async function getPostureTrend(limit = 90) {
  try {
    const rows = await prisma.postureSnapshot.findMany({
      orderBy: { snapshotDate: "desc" },
      take: limit,
    });
    return rows.reverse();
  } catch {
    return [];
  }
}
