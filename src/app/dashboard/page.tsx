import { Suspense } from "react";
import Header from "@/components/layout/Header";
import StatsCard from "@/components/dashboard/StatsCard";
import ComplianceGauge from "@/components/dashboard/ComplianceGauge";
import RiskHeatmap from "@/components/dashboard/RiskHeatmap";
import RemediationBurndown from "@/components/dashboard/RemediationBurndown";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { enforcePermission } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";
import { getRiskRating } from "@/types";
import {
  AlertTriangle,
  ShieldCheck,
  Wrench,
  ClipboardCheck,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

async function getDashboardData() {
  const risks = await prisma.risk.findMany({
    select: {
      inherentScore: true,
      residualScore: true,
      isOpen: true,
      title: true,
      riskId: true,
      likelihood: true,
      impact: true,
      owner: true,
      treatment: true,
    },
    orderBy: { inherentScore: "desc" },
  });

  const controls = await prisma.internalControl.findMany({
    select: { status: true },
  });

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

  const remediations = await prisma.remediation.findMany({
    include: {
      control: { select: { controlCode: true, title: true } },
      assignee: { select: { name: true, email: true } },
    },
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
  });

  const LIKELIHOOD_ORDER = ["RARE", "UNLIKELY", "POSSIBLE", "LIKELY", "ALMOST_CERTAIN"];
  const IMPACT_ORDER = ["NEGLIGIBLE", "MINOR", "MODERATE", "MAJOR", "CRITICAL"];

  const complianceSummaries = frameworks.map((fw) => {
    const reqs = fw.requirements;
    const total = reqs.length;
    const compliant = reqs.filter((r) => r.assessmentResults[0]?.status === "COMPLIANT").length;
    const partial = reqs.filter((r) => r.assessmentResults[0]?.status === "PARTIAL").length;
    const nonCompliant = reqs.filter((r) => r.assessmentResults[0]?.status === "NON_COMPLIANT").length;
    const score = total > 0 ? Math.round(((compliant + partial * 0.5) / total) * 100) : 0;
    return { framework: fw.name, slug: fw.slug, version: fw.version, total, compliant, partial, nonCompliant, score };
  });

  const now = new Date();
  const overdueRemediations = remediations.filter(
    (r) => r.dueDate && new Date(r.dueDate) < now && r.status !== "RESOLVED"
  );

  const burndownData: { week: string; open: number; resolved: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - i * 7);
    const label = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const openAtWeek = remediations.filter(
      (r) => new Date(r.createdAt) <= weekStart && (!r.resolvedAt || new Date(r.resolvedAt) > weekStart)
    ).length;
    const resolvedByWeek = remediations.filter(
      (r) => r.resolvedAt && new Date(r.resolvedAt) <= weekStart
    ).length;
    burndownData.push({ week: label, open: openAtWeek, resolved: resolvedByWeek });
  }

  const heatmapData = risks.map((r) => ({
    x: LIKELIHOOD_ORDER.indexOf(r.likelihood) + 1,
    y: IMPACT_ORDER.indexOf(r.impact) + 1,
    score: r.inherentScore,
    title: r.title,
    riskId: r.riskId,
    isOpen: r.isOpen,
  }));

  return { risks, controls, complianceSummaries, remediations, overdueRemediations, burndownData, heatmapData };
}

export default async function DashboardPage() {
  const user = await requireAuth();
  enforcePermission(user.role, "reports:read");
  const data = await getDashboardData();

  const criticalRisks = data.risks.filter((r) => r.inherentScore >= 15 && r.isOpen);
  const openRemediations = data.remediations.filter((r) => r.status === "OPEN" || r.status === "IN_PROGRESS");
  const implementedControls = data.controls.filter((c) => c.status === "IMPLEMENTED").length;

  return (
    <>
      <Header
        title="Executive Dashboard"
        subtitle={`Last updated ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`}
      />

      <main className="grc-page space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard
            title="Critical Open Risks"
            value={criticalRisks.length}
            subtitle="Score ≥ 15, unmitigated"
            icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
            iconBg="bg-red-50 dark:bg-red-950"
            trend={criticalRisks.length > 0 ? "down" : "neutral"}
            trendValue={criticalRisks.length > 0 ? "Requires immediate action" : "None – good posture"}
          />
          <StatsCard
            title="Controls Implemented"
            value={`${implementedControls}/${data.controls.length}`}
            subtitle="Internal controls active"
            icon={<ShieldCheck className="h-5 w-5 text-green-600" />}
            iconBg="bg-green-50 dark:bg-green-950"
            trend="up"
            trendValue={`${Math.round((implementedControls / data.controls.length) * 100)}% coverage`}
          />
          <StatsCard
            title="Open Remediations"
            value={openRemediations.length}
            subtitle={data.overdueRemediations.length > 0 ? `⚠ ${data.overdueRemediations.length} overdue` : "All within SLA"}
            icon={<Wrench className="h-5 w-5 text-orange-600" />}
            iconBg="bg-orange-50 dark:bg-orange-950"
            trend={data.overdueRemediations.length > 0 ? "down" : "neutral"}
            trendValue={`${data.remediations.filter((r) => r.status === "RESOLVED").length} resolved`}
          />
          <StatsCard
            title="Avg Compliance Score"
            value={
              data.complianceSummaries.length > 0
                ? `${Math.round(data.complianceSummaries.reduce((a, b) => a + b.score, 0) / data.complianceSummaries.length)}%`
                : "N/A"
            }
            subtitle={`Across ${data.complianceSummaries.length} frameworks`}
            icon={<ClipboardCheck className="h-5 w-5 text-blue-600" />}
            iconBg="bg-blue-50 dark:bg-blue-950"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ComplianceGauge frameworks={data.complianceSummaries} />
          <RiskHeatmap data={data.heatmapData} />
        </div>

        {/* Burndown */}
        <RemediationBurndown
          data={data.burndownData}
          total={data.remediations.length}
          open={openRemediations.length}
          resolved={data.remediations.filter((r) => r.status === "RESOLVED").length}
          overdue={data.overdueRemediations.length}
        />

        {/* Two-column bottom row */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Critical risks */}
          <div className="rounded-xl border bg-white dark:bg-gray-900 dark:border-gray-800 p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Most Critical Unmitigated Risks
              </h3>
              <Link href="/risks" className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-3">
              {criticalRisks.slice(0, 5).map((risk) => (
                <div key={risk.riskId} className="flex items-start gap-3 rounded-lg bg-red-50 dark:bg-red-950/40 p-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/60">
                    <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{risk.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {risk.riskId} · Owner: {risk.owner ?? "Unassigned"} · Score: {risk.inherentScore}
                    </p>
                  </div>
                  <span className="badge-critical flex-shrink-0">CRITICAL</span>
                </div>
              ))}
              {criticalRisks.length === 0 && (
                <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">
                  No critical open risks. Great posture!
                </p>
              )}
            </div>
          </div>

          {/* Open remediations */}
          <div className="rounded-xl border bg-white dark:bg-gray-900 dark:border-gray-800 p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Open Remediations
              </h3>
              <Link href="/remediation" className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-3">
              {openRemediations.slice(0, 5).map((rem) => {
                const isOverdue = rem.dueDate && new Date(rem.dueDate) < new Date();
                return (
                  <div key={rem.id} className="flex items-start gap-3 rounded-lg border dark:border-gray-700 p-3">
                    <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
                      rem.priority === 1 ? "bg-red-100 dark:bg-red-900/40"
                        : rem.priority === 2 ? "bg-orange-100 dark:bg-orange-900/40"
                        : "bg-yellow-100 dark:bg-yellow-900/40"
                    }`}>
                      <Wrench className={`h-4 w-4 ${
                        rem.priority === 1 ? "text-red-600 dark:text-red-400"
                          : rem.priority === 2 ? "text-orange-600 dark:text-orange-400"
                          : "text-yellow-600 dark:text-yellow-400"
                      }`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{rem.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {rem.control.controlCode} · {rem.assignee.name ?? rem.assignee.email}
                        {rem.dueDate && (
                          <span className={isOverdue ? "text-red-500 font-medium" : ""}>
                            {" "}· Due {formatDate(rem.dueDate)}
                            {isOverdue ? " ⚠ Overdue" : ""}
                          </span>
                        )}
                      </p>
                    </div>
                    {rem.jiraIssueKey && (
                      <a
                        href={rem.jiraIssueUrl ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 rounded border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900"
                      >
                        {rem.jiraIssueKey}
                      </a>
                    )}
                  </div>
                );
              })}
              {openRemediations.length === 0 && (
                <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">
                  No open remediations. All caught up!
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
