import Link from "next/link";
import Header from "@/components/layout/Header";
import PrintButton from "@/components/reports/PrintButton";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { enforcePermission } from "@/lib/rbac";
import {
  cn, formatControlStatus, getControlStatusClasses, getCriticalityClasses,
  getMaturityClasses, getRiskRating, getRiskBadgeClasses, formatDate,
  RISK_SOURCE_LABELS, MATURITY_LABELS, formatEnumLabel, computeControlRiskScore,
} from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

const PRIORITY_LABELS: Record<number, string> = { 1: "Critical", 2: "High", 3: "Medium", 4: "Low" };

async function getData() {
  const [controls, risks, remediations, latestAssessment] = await Promise.all([
    prisma.internalControl.findMany({
      include: {
        frameworkMappings: { include: { requirement: { include: { framework: true } } } },
        _count: { select: { evidence: true, remediations: true } },
      },
      orderBy: { controlCode: "asc" },
    }),
    prisma.risk.findMany({ orderBy: { inherentScore: "desc" } }),
    prisma.remediation.findMany({
      include: {
        control: { select: { controlCode: true } },
        risk: { select: { riskId: true } },
        assignee: { select: { name: true, email: true } },
      },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    }),
    prisma.assessment.findFirst({
      orderBy: { createdAt: "desc" },
      include: { conductor: { select: { name: true, version: true } }, _count: { select: { results: true } } },
    }),
  ]);
  return { controls, risks, remediations, latestAssessment };
}

export default async function TechnicalReportPage() {
  const user = await requireAuth();
  enforcePermission(user.role, "reports:read");
  const { controls, risks, remediations, latestAssessment } = await getData();

  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <>
      <Header title="Technical Report" subtitle={`Full control, risk & remediation detail · Generated ${today}`} />
      <main className="grc-page space-y-6">
        <div className="print-hidden flex items-center justify-between">
          <Link href="/reports" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600">
            <ArrowLeft className="h-4 w-4" /> Back to Reports
          </Link>
          <PrintButton />
        </div>

        {latestAssessment && (
          <div className="avoid-break rounded-xl border dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm text-sm text-gray-600 dark:text-gray-400">
            Latest assessment: <strong className="text-gray-900 dark:text-gray-100">{latestAssessment.title}</strong>{" "}
            ({latestAssessment.conductor.name} v{latestAssessment.conductor.version}, {formatDate(latestAssessment.startDate)},{" "}
            {latestAssessment._count.results} requirements assessed) —{" "}
            <Link href={`/assessments/${latestAssessment.id}`} className="print-hidden text-blue-600 hover:underline">view full drill-down</Link>
          </div>
        )}

        {/* Controls inventory */}
        <div className="avoid-break rounded-xl border dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
          <div className="border-b dark:border-gray-800 px-6 py-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Control Inventory ({controls.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr><th>Control</th><th>Category</th><th>Status</th><th>Criticality</th><th>Maturity</th><th>Risk Score</th><th>Frameworks</th><th>Owner</th><th>Evidence</th></tr>
              </thead>
              <tbody>
                {controls.map((c) => {
                  const fwSet = new Set(c.frameworkMappings.map((m) => m.requirement.framework.slug as string));
                  const riskScore = computeControlRiskScore(c.criticality as string, c.maturityLevel);
                  return (
                    <tr key={c.id}>
                      <td>
                        <p className="font-mono text-xs font-bold text-gray-500">{c.controlCode}</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{c.title}</p>
                      </td>
                      <td className="text-xs">{c.category ?? "—"}</td>
                      <td><span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium whitespace-nowrap", getControlStatusClasses(c.status))}>{formatControlStatus(c.status)}</span></td>
                      <td><span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold", getCriticalityClasses(c.criticality as string))}>{c.criticality}</span></td>
                      <td><span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap", getMaturityClasses(c.maturityLevel))}>L{c.maturityLevel} {MATURITY_LABELS[c.maturityLevel]}</span></td>
                      <td className="text-xs font-bold">{riskScore}</td>
                      <td className="text-xs">{Array.from(fwSet).join(", ") || "—"}</td>
                      <td className="text-xs">{c.owner ?? "—"}</td>
                      <td className="text-xs">{c._count.evidence}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Full risk register */}
        <div className="avoid-break rounded-xl border dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
          <div className="border-b dark:border-gray-800 px-6 py-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Risk Register ({risks.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr><th>Risk</th><th>Source</th><th>Owner / Lead</th><th>L / I / V</th><th>Inherent</th><th>Residual</th><th>Treatment</th><th>Status</th></tr>
              </thead>
              <tbody>
                {risks.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <p className="font-mono text-xs font-bold text-gray-500">{r.riskId}</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{r.title}</p>
                      {r.category && <p className="text-[10px] text-gray-400">{r.category}</p>}
                    </td>
                    <td className="text-xs whitespace-nowrap">{RISK_SOURCE_LABELS[r.source as string] ?? r.source}</td>
                    <td className="text-xs">
                      {r.owner ?? "—"}
                      {r.riskLead && <p className="text-blue-600 dark:text-blue-400">Lead: {r.riskLead}</p>}
                    </td>
                    <td className="text-[10px] whitespace-nowrap">{formatEnumLabel(r.likelihood)} / {formatEnumLabel(r.impact)} / {r.velocity}</td>
                    <td><span className={cn("rounded-full border px-2 py-0.5 text-xs font-bold", getRiskBadgeClasses(getRiskRating(r.inherentScore)))}>{r.inherentScore}</span></td>
                    <td><span className={cn("rounded-full border px-2 py-0.5 text-xs font-bold", getRiskBadgeClasses(getRiskRating(r.residualScore)))}>{r.residualScore}</span></td>
                    <td className="text-xs">{r.treatment}</td>
                    <td className="text-xs whitespace-nowrap">
                      {r.isOpen ? "Open" : "Closed"}
                      {r.isException && <span className="ml-1 rounded-full border border-amber-300 bg-amber-50 dark:bg-amber-950 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 dark:text-amber-400">EXCEPTION</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Remediation detail */}
        <div className="avoid-break rounded-xl border dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
          <div className="border-b dark:border-gray-800 px-6 py-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Remediation Plan ({remediations.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr><th>Remediation</th><th>Linked To</th><th>Priority</th><th>Complexity</th><th>Status</th><th>Assignee</th><th>Due</th><th>Jira</th></tr>
              </thead>
              <tbody>
                {remediations.map((rem) => (
                  <tr key={rem.id}>
                    <td className="text-sm font-medium text-gray-900 dark:text-gray-100">{rem.title}</td>
                    <td className="text-xs whitespace-nowrap">{[rem.control?.controlCode, rem.risk?.riskId].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="text-xs">{PRIORITY_LABELS[rem.priority] ?? rem.priority}</td>
                    <td className="text-xs">{rem.complexity ? formatEnumLabel(rem.complexity) : "—"}</td>
                    <td className="text-xs whitespace-nowrap">{formatEnumLabel(rem.status)}</td>
                    <td className="text-xs">{rem.assignee.name ?? rem.assignee.email}</td>
                    <td className="text-xs whitespace-nowrap">{rem.dueDate ? formatDate(rem.dueDate) : "—"}</td>
                    <td className="text-xs whitespace-nowrap">{[rem.jiraIssueKey, rem.jiraEpicKey].filter(Boolean).join(" / ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );
}
