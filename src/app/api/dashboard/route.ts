/**
 * Dashboard summary API
 * Returns aggregated compliance, risk, and remediation data
 * for the executive dashboard.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { enforcePermission } from "@/lib/rbac";

export async function GET() {
  try {
    const user = await requireAuth();
    enforcePermission(user.role, "reports:read");

    // ── Risk summary ─────────────────────────────────────────
    const risks = await prisma.risk.findMany({
      select: { inherentScore: true, residualScore: true, isOpen: true },
    });

    const riskSummary = {
      total: risks.length,
      open: risks.filter((r) => r.isOpen).length,
      critical: risks.filter((r) => r.inherentScore >= 15).length,
      high: risks.filter((r) => r.inherentScore >= 10 && r.inherentScore < 15).length,
      medium: risks.filter((r) => r.inherentScore >= 5 && r.inherentScore < 10).length,
      low: risks.filter((r) => r.inherentScore < 5).length,
    };

    // ── Controls summary ──────────────────────────────────────
    const controls = await prisma.internalControl.findMany({
      select: { status: true },
    });

    const controlsSummary = {
      total: controls.length,
      implemented: controls.filter((c) => c.status === "IMPLEMENTED").length,
      inProgress: controls.filter((c) => c.status === "IN_PROGRESS").length,
      notStarted: controls.filter((c) => c.status === "NOT_STARTED").length,
    };

    // ── Compliance by framework ───────────────────────────────
    const frameworks = await prisma.framework.findMany({
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
    });

    const complianceSummaries = frameworks.map((fw) => {
      const reqs = fw.requirements;
      const total = reqs.length;
      const compliant = reqs.filter(
        (r) => r.assessmentResults[0]?.status === "COMPLIANT"
      ).length;
      const partial = reqs.filter(
        (r) => r.assessmentResults[0]?.status === "PARTIAL"
      ).length;
      const nonCompliant = reqs.filter(
        (r) => r.assessmentResults[0]?.status === "NON_COMPLIANT"
      ).length;

      const score =
        total > 0 ? Math.round(((compliant + partial * 0.5) / total) * 100) : 0;

      return {
        framework: fw.name,
        slug: fw.slug,
        version: fw.version,
        total,
        compliant,
        partial,
        nonCompliant,
        notAssessed: total - compliant - partial - nonCompliant,
        score,
      };
    });

    // ── Remediation summary ───────────────────────────────────
    const remediations = await prisma.remediation.findMany({
      select: { status: true, createdAt: true, resolvedAt: true, dueDate: true },
      orderBy: { createdAt: "asc" },
    });

    const now = new Date();
    const remediationSummary = {
      total: remediations.length,
      open: remediations.filter((r) => r.status === "OPEN").length,
      inProgress: remediations.filter((r) => r.status === "IN_PROGRESS").length,
      resolved: remediations.filter((r) => r.status === "RESOLVED").length,
      overdue: remediations.filter(
        (r) => r.dueDate && new Date(r.dueDate) < now && r.status !== "RESOLVED"
      ).length,
    };

    // ── Burndown data (last 12 weeks) ─────────────────────────
    const burndownData: { week: string; open: number; resolved: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - i * 7);
      const label = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });

      const openAtWeek = remediations.filter(
        (r) =>
          new Date(r.createdAt) <= weekStart &&
          (!r.resolvedAt || new Date(r.resolvedAt) > weekStart)
      ).length;
      const resolvedByWeek = remediations.filter(
        (r) => r.resolvedAt && new Date(r.resolvedAt) <= weekStart
      ).length;

      burndownData.push({ week: label, open: openAtWeek, resolved: resolvedByWeek });
    }

    // ── Risk heatmap data ─────────────────────────────────────
    const allRisks = await prisma.risk.findMany({
      select: {
        riskId: true,
        title: true,
        likelihood: true,
        impact: true,
        inherentScore: true,
        isOpen: true,
      },
    });

    const LIKELIHOOD_ORDER = ["RARE", "UNLIKELY", "POSSIBLE", "LIKELY", "ALMOST_CERTAIN"];
    const IMPACT_ORDER = ["NEGLIGIBLE", "MINOR", "MODERATE", "MAJOR", "CRITICAL"];

    const heatmapData = allRisks.map((r) => ({
      x: LIKELIHOOD_ORDER.indexOf(r.likelihood) + 1,
      y: IMPACT_ORDER.indexOf(r.impact) + 1,
      score: r.inherentScore,
      title: r.title,
      riskId: r.riskId,
      isOpen: r.isOpen,
    }));

    return NextResponse.json({
      data: {
        risks: riskSummary,
        controls: controlsSummary,
        compliance: complianceSummaries,
        remediations: remediationSummary,
        burndown: burndownData,
        heatmap: heatmapData,
      },
    });
  } catch (err: any) {
    const status = err.message.startsWith("Unauthorized") ? 401
      : err.message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
