"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Papa from "papaparse";
import Header from "@/components/layout/Header";
import { ArrowLeft, Upload, CheckCircle2, AlertCircle, Loader2, Download, FileUp } from "lucide-react";
import { cn } from "@/lib/utils";

type ParsedRow = {
  controlCode: string;
  title: string;
  description: string;
  status?: string;
  criticality?: string;
  maturityLevel?: number;
  owner?: string;
  category?: string;
  tags?: string[];
  _error?: string;
};

const CSV_TEMPLATE = `controlCode,title,description,status,criticality,maturityLevel,owner,category,tags
IC-100,Multi-Factor Authentication,Require MFA for all user accounts,IMPLEMENTED,CRITICAL,3,IT Security,Identity & Access,mfa;identity
IC-101,Quarterly Access Reviews,Review privileged access every quarter,IN_PROGRESS,HIGH,1,IT Security,Identity & Access,access-review
IC-102,Network Segmentation,Segment staff and patron networks,NOT_STARTED,MEDIUM,0,Network Team,Network Security,`;

const VALID_STATUS = ["NOT_STARTED", "IN_PROGRESS", "IMPLEMENTED", "NOT_APPLICABLE"];
const VALID_CRIT = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export default function ControlsImportPage() {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const [result, setResult] = useState<{ created: number; updated: number; errors: { controlCode: string; error: string }[] } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState("");

  function parseCsv(text: string) {
    setParseError("");
    setResult(null);
    const parsed = Papa.parse<Record<string, string>>(text.trim(), {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    });
    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      setParseError(`Could not parse CSV: ${parsed.errors[0].message}`);
      setRows([]);
      return;
    }
    const mapped: ParsedRow[] = parsed.data.map((r) => {
      const row: ParsedRow = {
        controlCode: (r.controlCode ?? "").trim(),
        title: (r.title ?? "").trim(),
        description: (r.description ?? "").trim(),
        status: (r.status ?? "").trim().toUpperCase() || undefined,
        criticality: (r.criticality ?? "").trim().toUpperCase() || undefined,
        maturityLevel: r.maturityLevel?.trim() ? Number(r.maturityLevel) : undefined,
        owner: (r.owner ?? "").trim() || undefined,
        category: (r.category ?? "").trim() || undefined,
        tags: (r.tags ?? "").split(";").map((t) => t.trim()).filter(Boolean),
      };
      if (!row.controlCode) row._error = "Missing controlCode";
      else if (!row.title) row._error = "Missing title";
      else if (!row.description) row._error = "Missing description";
      else if (row.status && !VALID_STATUS.includes(row.status)) row._error = `Invalid status "${row.status}"`;
      else if (row.criticality && !VALID_CRIT.includes(row.criticality)) row._error = `Invalid criticality "${row.criticality}"`;
      else if (row.maturityLevel !== undefined && (isNaN(row.maturityLevel) || row.maturityLevel < 0 || row.maturityLevel > 5)) row._error = "maturityLevel must be 0–5";
      return row;
    });
    setRows(mapped);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => parseCsv(ev.target?.result as string);
    reader.readAsText(file);
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "controls_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const validRows = rows.filter((r) => !r._error);
  const invalidRows = rows.filter((r) => r._error);

  function handleImport() {
    setSubmitError("");
    startTransition(async () => {
      try {
        const res = await fetch("/api/controls/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            controls: validRows.map(({ _error, ...r }) => r),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Import failed");
        setResult(data.data);
        setRows([]);
        setFileName("");
      } catch (err: any) {
        setSubmitError(err.message);
      }
    });
  }

  return (
    <>
      <Header title="Import Controls" subtitle="Bulk create or update controls from CSV" />
      <main className="grc-page space-y-6 max-w-5xl">
        <Link href="/controls" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600">
          <ArrowLeft className="h-4 w-4" /> Back to Controls Library
        </Link>

        {/* Instructions */}
        <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/30 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-300">How it works</p>
              <p className="mt-1 text-xs text-blue-800 dark:text-blue-400">
                Upload a CSV with columns: controlCode, title, description (required) + status, criticality, maturityLevel, owner, category, tags (optional, tags semicolon-separated).
                Existing control codes are <strong>updated</strong>; new codes are <strong>created</strong>.
              </p>
            </div>
            <button onClick={downloadTemplate} className="flex flex-shrink-0 items-center gap-2 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-900 px-3 py-2 text-xs font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-50">
              <Download className="h-3.5 w-3.5" /> Download Template
            </button>
          </div>
        </div>

        {/* Result */}
        {result && (
          <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/40 p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-green-800 dark:text-green-300">
              <CheckCircle2 className="h-4 w-4" /> Import complete: {result.created} created, {result.updated} updated
              {result.errors.length > 0 && `, ${result.errors.length} failed`}
            </p>
            {result.errors.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-red-600 dark:text-red-400">
                {result.errors.map((e) => <li key={e.controlCode}>{e.controlCode}: {e.error}</li>)}
              </ul>
            )}
            <Link href="/controls" className="mt-3 inline-block rounded-lg bg-green-600 px-4 py-2 text-xs font-semibold text-white hover:bg-green-700">
              View Controls Library
            </Link>
          </div>
        )}

        {/* Upload */}
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-10 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition-colors">
          <FileUp className="h-8 w-8 text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{fileName || "Click to select a CSV file"}</span>
          <span className="text-xs text-gray-400">or drag and drop</span>
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
        </label>

        {parseError && (
          <p className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-4 py-3 text-sm text-red-600 dark:text-red-400">{parseError}</p>
        )}

        {/* Preview */}
        {rows.length > 0 && (
          <div className="overflow-hidden rounded-xl border dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
            <div className="flex items-center justify-between border-b dark:border-gray-800 px-6 py-4">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Preview — {validRows.length} valid{invalidRows.length > 0 ? `, ${invalidRows.length} with errors (skipped)` : ""}
              </p>
              <button
                onClick={handleImport}
                disabled={isPending || validRows.length === 0}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Import {validRows.length} Control{validRows.length !== 1 ? "s" : ""}
              </button>
            </div>
            <div className="max-h-96 overflow-auto">
              <table className="data-table w-full">
                <thead>
                  <tr><th></th><th>Code</th><th>Title</th><th>Status</th><th>Criticality</th><th>Maturity</th><th>Category</th><th>Owner</th></tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className={cn(r._error && "bg-red-50/60 dark:bg-red-950/20")}>
                      <td>
                        {r._error
                          ? <span title={r._error}><AlertCircle className="h-4 w-4 text-red-500" /></span>
                          : <CheckCircle2 className="h-4 w-4 text-green-500" />}
                      </td>
                      <td className="font-mono text-xs font-bold">{r.controlCode || "—"}</td>
                      <td className="text-sm">{r.title || <span className="text-red-500 text-xs">{r._error}</span>}</td>
                      <td className="text-xs">{r.status ?? "NOT_STARTED"}</td>
                      <td className="text-xs">{r.criticality ?? "MEDIUM"}</td>
                      <td className="text-xs">{r.maturityLevel ?? 0}</td>
                      <td className="text-xs">{r.category ?? "—"}</td>
                      <td className="text-xs">{r.owner ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {invalidRows.length > 0 && (
              <div className="border-t dark:border-gray-800 bg-red-50/60 dark:bg-red-950/20 px-6 py-3 text-xs text-red-600 dark:text-red-400">
                Rows with errors are skipped. Hover the ⚠ icon for details.
              </div>
            )}
          </div>
        )}

        {submitError && (
          <p className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-4 py-3 text-sm text-red-600 dark:text-red-400">{submitError}</p>
        )}
      </main>
    </>
  );
}
