import Link from "next/link";
import Header from "@/components/layout/Header";
import PrintButton from "@/components/reports/PrintButton";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { enforcePermission } from "@/lib/rbac";
import {
  cn, computeComplianceScore, computeControlRiskScore, getRiskRating,
  getRiskBadgeClasses, formatDate, RISK_SOURCE_LABELS,
} from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

async function getData() {
  const [risks, controls, frameworks, remediations] = await Promise.all([
    prisma.risk.findMany({ orderBy: { inherentScore: "desc" } }),
    prisma.internalControl.findMany(),
    prisma.framework.findMany({
      include: {
        requirements: {
          include: { assessmentResults: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true } } },
        },
      },
    }),
    prisma.remediation.findMany({ include: { assignee: { select: { name: true, email: true } } } }),
  ]);
  return { risks, controls, frameworks, remediations };
}

export default async function ExecutiveReportPage() {
  const user = await requireAuth();
  enforcePermission(user.role, "reports:read");
  const { risks, controls, frameworks, remediations } = await getData();

  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  // Compliance
  const frameworkScores = frameworks
    .map((fw) => {
      const total = fw.requirements.length;
      const compliant = fw.requirements.filter((r) => r.assessmentResults[0]?.status === "COMPLIANT").length;
      const partial = fw.requirements.filter((r) => r.assessmentResults[0]?.status === "PARTIAL").length;
      return { name: fw.name, version: fw.version, score: computeComplianceScore(compliant, partial, total), total, compliant, partial };
    })
    .filter((f) => f.total > 0);

  // Risk posture
  const openRisks = risks.filter((r) => r.isOpen);
  const criticalOpen = openRisks.filter((r) => r.inherentScore >= 15);
  const exceptions = risks.filter((r) => r.isException);
  const overdueExceptions = exceptions.filter((r) => r.exceptionNextReview && new Date(r.exceptionNextReview) < new Date());

  // Control posture
  const activeControls = controls.filter((c) => c.status !== "NOT_APPLICABLE");
  const implemented = controls.filter((c) => c.status === "IMPLEMENTED").length;
  const controlRisk = activeControls.length > 0
    ? Math.round(activeControls.reduce((s, c) => s + computeControlRiskScore(c.criticality as string, c.maturityLevel), 0) / activeControls.length)
    : 0;
  const avgMaturity = activeControls.length > 0
    ? (activeControls.reduce((s, c) => s + c.maturityLevel, 0) / activeControls.length).toFixed(1)
    : "0";

  // Remediation
  const openRems = remediations.filter((r) => r.status === "OPEN" || r.status === "IN_PROGRESS");
  const overdueRems = openRems.filter((r) => r.dueDate && new Date(r.dueDate) < new Date());
  const resolvedRems = remediations.filter((r) => r.status === "RESOLVED").length;

  const postureLabel =
    controlRisk >= 60 || criticalOpen.length > 2 ? "Needs Attention"
    : controlRisk >= 40 || criticalOpen.length > 0 ? "Improving"
    : "Strong";

  return (
    <>
      <Header title="Executive Report" subtitle={`Security & Compliance Posture · Generated ${today}`} />
      <main className="grc-page space-y-6 max-w-5xl">
        <div className="print-hidden flex items-center justify-between">
          <Link href="/reports" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600">
            <ArrowLeft className="h-4 w-4" /> Back to Reports
          </Link>
          <PrintButton />
        </div>

        {/* Executive summary */}
        <div className="avoid-break rounded-xl border dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">Executive Summary</h3>
          <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            The organization&apos;s overall security posture is <strong>{postureLabel}</strong>.{" "}
            {implemented} of {controls.length} internal controls are implemented ({controls.length > 0 ? Math.round((implemented / controls.length) * 100) : 0}% coverage),
            with an average control maturity of {avgMaturity} / 5 and an overall control risk score of {controlRisk} / 100 (lower is better).{" "}
            The risk register contains {risks.length} risks, of which {openRisks.length} are open and {criticalOpen.length} are rated critical.{" "}
            {exceptions.length > 0 && `${exceptions.length} formal risk exception${exceptions.length > 1 ? "s are" : " is"} in effect${overdueExceptions.length > 0 ? `, ${overdueExceptions.length} of which ${overdueExceptions.length > 1 ? "are" : "is"} overdue for review` : ""}. `}
            Remediation efforts show {resolvedRems} of {remediations.length} items resolved, with {openRems.length} in flight{overdueRems.length > 0 ? ` (${overdueRems.length} overdue)` : ""}.
          </p>
        </div>

        {/* Key metrics */}
        <div className="avoid-break grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: "Control Coverage", value: `${controls.length > 0 ? Math.round((implemented / controls.length) * 100) : 0}%`, sub: `${implemented}/${controls.length} implemented` },
            { label: "Control Risk Score", value: `${controlRisk}`, sub: "of 100 · lower is better" },
            { label: "Critical Open Risks", value: `${criticalOpen.length}`, sub: "inherent score ≥ 15" },
            { label: "Remediation Closure", value: `${remediations.length > 0 ? Math.round((resolvedRems / remediations.length) * 100) : 0}%`, sub: `${resolvedRems}/${remediations.length} resolved` },
          ].map((m) => (
            <div key={m.label} className="rounded-xl border dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{m.label}</p>
              <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-gray-100">{m.value}</p>
              <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{m.sub}</p>
            </div>
          ))}
        </div>

        {/* Framework compliance */}
        <div className="avoid-break rounded-xl border dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Framework Compliance</h3>
          <div className="space-y-4">
            {frameworkScores.map((fw) => (
              <div key={fw.name}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700 dark:text-gray-300">{fw.name} v{fw.version}</span>
                  <span className={cn("font-bold", fw.score >= 80 ? "text-green-600" : fw.score >= 60 ? "text-yellow-600" : "text-red-600")}>{fw.score}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div className={cn("h-full rounded-full", fw.score >= 80 ? "bg-green-500" : fw.score >= 60 ? "bg-yellow-400" : "bg-red-400")} style={{ width: `${fw.score}%` }} />
                </div>
              </div>
            ))}
            {frameworkScores.length === 0 && <p className="text-sm text-gray-400">No assessments completed yet.</p>}
          </div>
        </div>

        {/* Top risks */}
        <div className="avoid-break rounded-xl border dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Top Open Risks</h3>
          <table className="data-table w-full">
            <thead>
              <tr><th>Risk</th><th>Source</th><th>Owner</th><th>Inherent</th><th>Residual</th><th>Treatment</th></tr>
            </thead>
            <tbody>
              {openRisks.slice(0, 8).map((r) => (
                <tr key={r.id}>
                  <td>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{r.riskId} · {r.title}</p>
                  </td>
                  <td className="text-xs">{RISK_SOURCE_LABELS[r.source as string] ?? r.source}</td>
                  <td className="text-xs">{r.owner ?? "—"}</td>
                  <td>
                    <span className={cn("rounded-full border px-2 py-0.5 text-xs font-bold", getRiskBadgeClasses(getRiskRating(r.inherentScore)))}>{r.inherentScore}</span>
                  </td>
                  <td>
                    <span className={cn("rounded-full border px-2 py-0.5 text-xs font-bold", getRiskBadgeClasses(getRiskRating(r.residualScore)))}>{r.residualScore}</span>
                  </td>
                  <td className="text-xs">{r.treatment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Risk exceptions */}
        {exceptions.length > 0 && (
          <div className="avoid-break rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 p-6 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Active Risk Exceptions</h3>
            <table className="data-table w-full">
              <thead>
                <tr><th>Risk</th><th>Approved By</th><th>Review Cadence</th><th>Next Review</th></tr>
              </thead>
              <tbody>
                {exceptions.map((r) => {
                  const overdue = r.exceptionNextReview && new Date(r.exceptionNextReview) < new Date();
                  return (
                    <tr key={r.id}>
                      <td className="font-medium text-gray-900 dark:text-gray-100">{r.riskId} · {r.title}</td>
                      <td className="text-xs">{r.exceptionApprovedBy ?? "—"}</td>
                      <td className="text-xs">{r.exceptionReviewCadence ?? "—"}</td>
                      <td className={cn("text-xs", overdue && "font-bold text-red-600")}>
                        {r.exceptionNextReview ? formatDate(r.exceptionNextReview) : "—"}{overdue && " ⚠ OVERDUE"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
