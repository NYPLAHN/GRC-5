"use client";

import { useState, useEffect, useTransition } from "react";
import Header from "@/components/layout/Header";
import { Upload, Plus, X, Loader2, ClipboardList, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Assessment = {
  id: string;
  title: string;
  startDate: string;
  endDate: string | null;
  conductor: { name: string | null; version: string };
  summary: { total: number; compliant: number; partial: number; nonCompliant: number; score: number };
};

type Framework = { id: string; name: string; slug: string; version: string };

const CSV_TEMPLATE = `controlCode,requirementId,status,score,notes
IC-001,,COMPLIANT,95,MFA implemented across all systems
IC-002,,PARTIAL,60,Hardware inventory complete; software inventory in progress
IC-003,,NON_COMPLIANT,20,Vulnerability scanning not yet deployed
IC-009,,NOT_APPLICABLE,,Scoped out for this assessment`;

export default function AssessmentsPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [csvContent, setCsvContent] = useState("");
  const [importError, setImportError] = useState("");
  const [form, setForm] = useState({ title: "", frameworkId: "", startDate: "", notes: "" });
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    Promise.all([
      fetch("/api/assessments").then((r) => r.json()),
      fetch("/api/frameworks").then((r) => r.json()).catch(() => ({ data: [] })),
    ]).then(([assessData, fwData]) => {
      setAssessments(assessData.data ?? []);
      setFrameworks(fwData.data ?? []);
    }).finally(() => setLoading(false));
  }, []);

  function parseCsv(csv: string) {
    const lines = csv.trim().split("\n");
    const headers = lines[0].split(",");
    return lines.slice(1).map((line) => {
      const vals = line.split(",");
      const row: any = {};
      headers.forEach((h, i) => { row[h.trim()] = vals[i]?.trim() ?? ""; });
      return row;
    });
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvContent(ev.target?.result as string);
    reader.readAsText(file);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setImportError("");
    startTransition(async () => {
      try {
        let results: any[] = [];
        if (csvContent.trim()) {
          const parsed = parseCsv(csvContent);
          results = parsed.map((row) => ({
            controlId: row.controlCode,
            requirementId: row.requirementId || undefined,
            status: row.status as any,
            score: row.score ? parseInt(row.score, 10) : undefined,
            notes: row.notes || undefined,
          })).filter((r) => r.status);
        }
        const res = await fetch("/api/assessments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, results }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed");
        setAssessments((prev) => [data.data, ...prev]);
        setShowModal(false);
      } catch (err: any) {
        setImportError(err.message);
      }
    });
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "grc_assessment_template.csv"; a.click();
  }

  return (
    <>
      <Header title="Assessments" subtitle="Evaluate compliance against framework requirements" />
      <main className="grc-page space-y-6">
        {/* Upload CTA */}
        <div className="flex items-center justify-between rounded-xl border bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 dark:border-blue-900/50 p-5">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Bulk Assessment Import</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Upload a CSV or JSON file with assessment results to score multiple controls at once.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={downloadTemplate} className="rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-900 px-3 py-2 text-xs font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40">Download CSV Template</button>
            <button onClick={() => setShowModal(true)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">
              <Plus className="h-3.5 w-3.5" /> New Assessment
            </button>
          </div>
        </div>

        {/* List */}
        <div className="overflow-hidden rounded-xl border dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <div className="border-b dark:border-gray-800 px-6 py-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Assessments ({assessments.length})</h2>
          </div>
          <div className="divide-y dark:divide-gray-800">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-300" /></div>
            ) : assessments.length === 0 ? (
              <div className="py-16 text-center text-sm text-gray-400 dark:text-gray-500">No assessments yet. Create your first assessment above.</div>
            ) : (
              assessments.map((a) => (
                <div key={a.id} className="flex items-center gap-4 p-5 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950">
                    <ClipboardList className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{a.title}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {a.conductor?.name ?? "Unknown framework"} · {new Date(a.startDate).toLocaleDateString()}
                      {a.endDate && ` → ${new Date(a.endDate).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="hidden sm:flex gap-3 text-xs">
                      <span className="flex items-center gap-1 text-green-600 dark:text-green-400"><CheckCircle2 className="h-3.5 w-3.5" />{a.summary.compliant}</span>
                      <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400"><AlertCircle className="h-3.5 w-3.5" />{a.summary.partial}</span>
                      <span className="flex items-center gap-1 text-red-500 dark:text-red-400"><X className="h-3.5 w-3.5" />{a.summary.nonCompliant}</span>
                    </div>
                    <div className="text-center">
                      <div className={cn("rounded-full px-3 py-1 text-sm font-bold",
                        a.summary.score >= 80 ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                          : a.summary.score >= 60 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400"
                          : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                      )}>{a.summary.score}%</div>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">compliance</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white dark:bg-gray-900 shadow-2xl">
            <div className="flex items-center justify-between border-b dark:border-gray-800 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">New Assessment</h2>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-800"><X className="h-5 w-5 dark:text-gray-400" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Assessment Title *</label>
                  <input required className="w-full rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Q2 2026 NIST CSF Assessment" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Framework *</label>
                  <select required className="w-full rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.frameworkId} onChange={(e) => setForm((f) => ({ ...f, frameworkId: e.target.value }))}>
                    <option value="">Select framework...</option>
                    {frameworks.map((fw) => <option key={fw.id} value={fw.id}>{fw.name} v{fw.version}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Start Date *</label>
                  <input required type="date" className="w-full rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Bulk Import (CSV) — Optional</label>
                  <button type="button" onClick={downloadTemplate} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Download template</button>
                </div>
                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-6 hover:border-blue-300 hover:bg-blue-50 dark:hover:border-blue-700 dark:hover:bg-blue-950/30 transition-colors">
                  <Upload className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {csvContent ? `✓ CSV loaded (${csvContent.trim().split("\n").length - 1} rows)` : "Click to upload CSV or drag and drop"}
                  </span>
                  <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                </label>
                {csvContent && (
                  <pre className="mt-2 max-h-32 overflow-auto rounded-lg border dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 text-xs text-gray-600 dark:text-gray-400">
                    {csvContent.slice(0, 400)}{csvContent.length > 400 ? "..." : ""}
                  </pre>
                )}
              </div>

              {importError && <p className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-600 dark:text-red-400">{importError}</p>}

              <div className="flex gap-3 border-t dark:border-gray-800 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 rounded-lg border dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">Cancel</button>
                <button type="submit" disabled={isPending} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                  {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create Assessment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
