import Header from "@/components/layout/Header";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { enforcePermission } from "@/lib/rbac";
import { cn, computeComplianceScore } from "@/lib/utils";
import { BarChart3, FileText, TrendingUp } from "lucide-react";

async function getReportData() {
  const [risks, controls, frameworks, remediations] = await Promise.all([
    prisma.risk.findMany({ orderBy: { inherentScore: "desc" } }),
    prisma.internalControl.findMany({
      include: { frameworkMappings: { include: { requirement: { include: { framework: true } } } } },
    }),
    prisma.framework.findMany({
      include: {
        requirements: {
          include: { assessmentResults: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true } } },
        },
      },
    }),
    prisma.remediation.findMany(),
  ]);
  return { risks, controls, frameworks, remediations };
}

export default async function ReportsPage() {
  const user = await requireAuth();
  enforcePermission(user.role, "reports:read");
  const { risks, controls, frameworks, remediations } = await getReportData();

  const criticalRisks = risks.filter((r) => r.inherentScore >= 15 && r.isOpen);
  const controlCoverage = Math.round(
    (controls.filter((c) => c.status === "IMPLEMENTED").length / controls.length) * 100
  );

  const frameworkScores = frameworks.map((fw) => {
    const total = fw.requirements.length;
    const compliant = fw.requirements.filter((r) => r.assessmentResults[0]?.status === "COMPLIANT").length;
    const partial = fw.requirements.filter((r) => r.assessmentResults[0]?.status === "PARTIAL").length;
    const score = computeComplianceScore(compliant, partial, total);
    return { name: fw.name, slug: fw.slug, version: fw.version, score, total, compliant, partial };
  });

  const crossFrameworkGaps = controls.filter((ctrl) => {
    const nistReqs = ctrl.frameworkMappings.filter((m) => m.requirement.framework.slug === "NIST_CSF_2");
    const cisReqs = ctrl.frameworkMappings.filter((m) => m.requirement.framework.slug === "CIS_V8_1");
    return nistReqs.length > 0 && cisReqs.length === 0;
  });

  return (
    <>
      <Header title="Reports" subtitle="Executive reporting & gap analysis" />
      <main className="grc-page space-y-6">
        {/* Report Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-gradient-to-br from-blue-600 to-blue-700 p-5 text-white shadow-sm">
            <TrendingUp className="mb-3 h-6 w-6 opacity-80" />
            <p className="text-sm font-medium opacity-80">Overall Control Coverage</p>
            <p className="mt-1 text-4xl font-bold">{controlCoverage}%</p>
            <p className="mt-1 text-xs opacity-60">
              {controls.filter((c) => c.status === "IMPLEMENTED").length}/{controls.length} controls implemented
            </p>
          </div>
          <div className="rounded-xl border bg-gradient-to-br from-red-500 to-red-600 p-5 text-white shadow-sm">
            <BarChart3 className="mb-3 h-6 w-6 opacity-80" />
            <p className="text-sm font-medium opacity-80">Critical Open Risks</p>
            <p className="mt-1 text-4xl font-bold">{criticalRisks.length}</p>
            <p className="mt-1 text-xs opacity-60">Score ≥ 15 requiring immediate action</p>
          </div>
          <div className="rounded-xl border bg-gradient-to-br from-green-600 to-emerald-600 p-5 text-white shadow-sm">
            <FileText className="mb-3 h-6 w-6 opacity-80" />
            <p className="text-sm font-medium opacity-80">Remediations Resolved</p>
            <p className="mt-1 text-4xl font-bold">{remediations.filter((r) => r.status === "RESOLVED").length}</p>
            <p className="mt-1 text-xs opacity-60">
              of {remediations.length} total ({Math.round((remediations.filter((r) => r.status === "RESOLVED").length / Math.max(remediations.length, 1)) * 100)}% closure rate)
            </p>
          </div>
        </div>

        {/* Framework scores */}
        <div className="rounded-xl border dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Framework Compliance Scores</h3>
          </div>
          <div className="space-y-4">
            {frameworkScores.map((fw) => (
              <div key={fw.slug}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {fw.name} <span className="text-xs font-normal text-gray-400 dark:text-gray-500">v{fw.version}</span>
                  </span>
                  <span className={cn("font-bold",
                    fw.score >= 80 ? "text-green-600 dark:text-green-400"
                      : fw.score >= 60 ? "text-yellow-600 dark:text-yellow-400"
                      : "text-red-600 dark:text-red-400"
                  )}>{fw.score}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div
                    className={cn("h-full rounded-full transition-all",
                      fw.score >= 80 ? "bg-green-500" : fw.score >= 60 ? "bg-yellow-400" : "bg-red-400"
                    )}
                    style={{ width: `${fw.score}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  {fw.compliant} compliant · {fw.partial} partial · {fw.total - fw.compliant - fw.partial} not assessed
                </p>
              </div>
            ))}
            {frameworkScores.length === 0 && (
              <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">Run assessments to see compliance scores.</p>
            )}
          </div>
        </div>

        {/* Cross-framework gap analysis */}
        <div className="rounded-xl border dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
          <h3 className="mb-1 text-base font-semibold text-gray-900 dark:text-gray-100">Cross-Framework Gap Analysis</h3>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            Controls that satisfy NIST CSF 2.0 but have not been mapped to CIS Controls v8.1 — potential blind spots.
          </p>
          {crossFrameworkGaps.length === 0 ? (
            <div className="rounded-xl bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 p-4 text-sm text-green-700 dark:text-green-400 font-medium">
              All NIST-mapped controls also have CIS v8.1 mappings. No cross-framework gaps found.
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium text-orange-700 dark:text-orange-400">{crossFrameworkGaps.length} controls need CIS v8.1 mapping:</p>
              {crossFrameworkGaps.map((ctrl) => (
                <div key={ctrl.id} className="flex items-center gap-3 rounded-lg border border-orange-100 dark:border-orange-900/50 bg-orange-50 dark:bg-orange-950/30 p-3">
                  <span className="rounded border border-orange-200 dark:border-orange-800 bg-white dark:bg-gray-900 px-2 py-0.5 text-xs font-mono font-bold text-orange-700 dark:text-orange-400">{ctrl.controlCode}</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300">{ctrl.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top risks */}
        <div className="rounded-xl border dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">Top 10 Unmitigated Risks by Inherent Score</h3>
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Risk ID</th><th>Title</th><th>Owner</th><th>Inherent</th><th>Residual</th><th>Risk Reduction</th><th>Treatment</th>
                </tr>
              </thead>
              <tbody>
                {risks.filter((r) => r.isOpen).slice(0, 10).map((risk) => {
                  const reduction = risk.inherentScore - risk.residualScore;
                  const reductionPct = Math.round((reduction / risk.inherentScore) * 100);
                  return (
                    <tr key={risk.id}>
                      <td className="font-mono text-xs font-bold text-gray-500 dark:text-gray-400">{risk.riskId}</td>
                      <td className="font-medium text-gray-900 dark:text-gray-100 max-w-xs truncate">{risk.title}</td>
                      <td className="text-sm text-gray-500 dark:text-gray-400">{risk.owner ?? "—"}</td>
                      <td>
                        <span className={cn("rounded-full border px-2 py-0.5 text-xs font-bold",
                          risk.inherentScore >= 15 ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800"
                            : risk.inherentScore >= 10 ? "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800"
                            : "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800"
                        )}>{risk.inherentScore}</span>
                      </td>
                      <td>
                        <span className="rounded-full border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950 px-2 py-0.5 text-xs font-bold text-green-700 dark:text-green-400">{risk.residualScore}</span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                            <div className="h-full rounded-full bg-blue-500" style={{ width: `${reductionPct}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{reductionPct}%</span>
                        </div>
                      </td>
                      <td>
                        <span className="rounded border px-2 py-0.5 text-[10px] font-semibold uppercase bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400">{risk.treatment}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );
}
