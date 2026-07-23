"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, FileSpreadsheet, Download, Loader2, Briefcase, Cpu } from "lucide-react";
import { toCsv, downloadCsv, getRiskRating, RISK_SOURCE_LABELS, formatEnumLabel } from "@/lib/utils";

export default function ReportActions() {
  const [exporting, setExporting] = useState<"" | "risks" | "remediations">("");

  async function exportRisks() {
    setExporting("risks");
    try {
      const res = await fetch("/api/risks");
      const { data } = await res.json();
      const rows = (data ?? []).map((r: any) => ({
        riskId: r.riskId,
        title: r.title,
        description: r.description,
        category: r.category ?? "",
        source: RISK_SOURCE_LABELS[r.source] ?? r.source ?? "",
        owner: r.owner ?? "",
        riskLead: r.riskLead ?? "",
        likelihood: r.likelihood,
        impact: r.impact,
        velocity: r.velocity,
        inherentScore: r.inherentScore,
        inherentRating: getRiskRating(r.inherentScore),
        residualScore: r.residualScore,
        residualRating: getRiskRating(r.residualScore),
        treatment: r.treatment,
        treatmentDetails: r.treatmentDetails ?? "",
        status: r.isOpen ? "Open" : "Closed",
        isException: r.isException ? "Yes" : "No",
        exceptionJustification: r.exceptionJustification ?? "",
        exceptionApprovedBy: r.exceptionApprovedBy ?? "",
        exceptionReviewCadence: r.exceptionReviewCadence ? formatEnumLabel(r.exceptionReviewCadence) : "",
        exceptionNextReview: r.exceptionNextReview ? r.exceptionNextReview.slice(0, 10) : "",
      }));
      const csv = toCsv(rows, [
        { key: "riskId", label: "Risk ID" },
        { key: "title", label: "Title" },
        { key: "description", label: "Description" },
        { key: "category", label: "Category" },
        { key: "source", label: "Source" },
        { key: "owner", label: "Owner" },
        { key: "riskLead", label: "Risk Lead" },
        { key: "likelihood", label: "Likelihood" },
        { key: "impact", label: "Impact" },
        { key: "velocity", label: "Velocity" },
        { key: "inherentScore", label: "Inherent Score" },
        { key: "inherentRating", label: "Inherent Rating" },
        { key: "residualScore", label: "Residual Score" },
        { key: "residualRating", label: "Residual Rating" },
        { key: "treatment", label: "Treatment" },
        { key: "treatmentDetails", label: "Treatment Details" },
        { key: "status", label: "Status" },
        { key: "isException", label: "Exception" },
        { key: "exceptionJustification", label: "Exception Justification" },
        { key: "exceptionApprovedBy", label: "Exception Approved By" },
        { key: "exceptionReviewCadence", label: "Exception Review Cadence" },
        { key: "exceptionNextReview", label: "Exception Next Review" },
      ]);
      downloadCsv(`risk_register_${new Date().toISOString().slice(0, 10)}.csv`, csv);
    } finally {
      setExporting("");
    }
  }

  async function exportRemediations() {
    setExporting("remediations");
    try {
      const res = await fetch("/api/remediation");
      const { data } = await res.json();
      const priorityLabels: Record<number, string> = { 1: "Critical", 2: "High", 3: "Medium", 4: "Low" };
      const rows = (data ?? []).map((r: any) => ({
        title: r.title,
        description: r.description,
        control: r.control?.controlCode ?? "",
        risk: r.risk?.riskId ?? "",
        status: formatEnumLabel(r.status),
        priority: priorityLabels[r.priority] ?? r.priority,
        complexity: r.complexity ? formatEnumLabel(r.complexity) : "",
        assignee: r.assignee?.name ?? r.assignee?.email ?? "",
        dueDate: r.dueDate ? r.dueDate.slice(0, 10) : "",
        resolvedAt: r.resolvedAt ? r.resolvedAt.slice(0, 10) : "",
        jiraIssueKey: r.jiraIssueKey ?? "",
        jiraEpicKey: r.jiraEpicKey ?? "",
        createdAt: r.createdAt ? r.createdAt.slice(0, 10) : "",
      }));
      const csv = toCsv(rows, [
        { key: "title", label: "Title" },
        { key: "description", label: "Description" },
        { key: "control", label: "Linked Control" },
        { key: "risk", label: "Linked Risk" },
        { key: "status", label: "Status" },
        { key: "priority", label: "Priority" },
        { key: "complexity", label: "Complexity" },
        { key: "assignee", label: "Assignee" },
        { key: "dueDate", label: "Due Date" },
        { key: "resolvedAt", label: "Resolved At" },
        { key: "jiraIssueKey", label: "Jira Task" },
        { key: "jiraEpicKey", label: "Jira Epic" },
        { key: "createdAt", label: "Created" },
      ]);
      downloadCsv(`remediations_${new Date().toISOString().slice(0, 10)}.csv`, csv);
    } finally {
      setExporting("");
    }
  }

  const cardCls =
    "flex items-center gap-4 rounded-xl border dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm transition-all hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 text-left";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Link href="/reports/executive" className={cardCls}>
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950">
          <Briefcase className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Executive Report</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Board-ready summary · printable</p>
        </div>
      </Link>
      <Link href="/reports/technical" className={cardCls}>
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-950">
          <Cpu className="h-5 w-5 text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Technical Report</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Full control & risk detail · printable</p>
        </div>
      </Link>
      <button onClick={exportRisks} disabled={exporting !== ""} className={cardCls}>
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-orange-50 dark:bg-orange-950">
          {exporting === "risks" ? <Loader2 className="h-5 w-5 animate-spin text-orange-500" /> : <FileSpreadsheet className="h-5 w-5 text-orange-600 dark:text-orange-400" />}
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">Risks CSV <Download className="h-3 w-3 text-gray-400" /></p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Full register incl. exceptions</p>
        </div>
      </button>
      <button onClick={exportRemediations} disabled={exporting !== ""} className={cardCls}>
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-green-50 dark:bg-green-950">
          {exporting === "remediations" ? <Loader2 className="h-5 w-5 animate-spin text-green-500" /> : <FileText className="h-5 w-5 text-green-600 dark:text-green-400" />}
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">Remediations CSV <Download className="h-3 w-3 text-gray-400" /></p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Incl. Jira, complexity, status</p>
        </div>
      </button>
    </div>
  );
}
