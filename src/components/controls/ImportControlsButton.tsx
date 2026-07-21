"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, Plus, X, Loader2, Download } from "lucide-react";

const CSV_TEMPLATE = `controlCode,title,description,status,owner,category,tags
NYPL-001,MFA Implementation,Enforce multi-factor authentication across all systems and applications,IMPLEMENTED,IAM Team,Identity & Access Management,mfa;authentication;identity
NYPL-002,Vulnerability Scanning,Conduct monthly authenticated vulnerability scans and enforce patch SLAs,IN_PROGRESS,Security Operations,Vulnerability Management,vulnerability;patching;scanning
NYPL-003,Security Awareness Training,Deliver annual security awareness training and phishing simulations to all staff,IMPLEMENTED,Information Security,Awareness & Training,training;phishing;awareness`;

type ParsedControl = {
  controlCode: string;
  title: string;
  description: string;
  status: string;
  owner: string;
  category: string;
  tags: string[];
};

function parseCsv(csv: string): ParsedControl[] {
  const lines = csv.trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const vals = line.split(",");
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = vals[i]?.trim() ?? ""; });
    return {
      controlCode: row.controlCode ?? "",
      title: row.title ?? "",
      description: row.description ?? "",
      status: row.status || "NOT_STARTED",
      owner: row.owner ?? "",
      category: row.category ?? "",
      tags: row.tags ? row.tags.split(";").map((t) => t.trim()).filter(Boolean) : [],
    };
  }).filter((r) => r.controlCode && r.title);
}

export default function ImportControlsButton({ onImported }: { onImported?: () => void } = {}) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [csvContent, setCsvContent] = useState("");
  const [preview, setPreview] = useState<ParsedControl[]>([]);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ created: number; updated: number } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setCsvContent(content);
      setPreview(parseCsv(content));
      setError("");
      setResult(null);
    };
    reader.readAsText(file);
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "controls_import_template.csv";
    a.click();
  }

  function handleClose() {
    setShowModal(false);
    setCsvContent("");
    setPreview([]);
    setError("");
    setResult(null);
  }

  function handleSubmit() {
    if (preview.length === 0) { setError("No valid controls found in CSV."); return; }
    setError("");
    startTransition(async () => {
      try {
        const res = await fetch("/api/controls/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ controls: preview }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Import failed");
        setResult(data.data);
        onImported?.();
        router.refresh();
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  const STATUS_COLORS: Record<string, string> = {
    IMPLEMENTED: "bg-green-100 text-green-700",
    IN_PROGRESS: "bg-yellow-100 text-yellow-700",
    NOT_STARTED: "bg-red-100 text-red-700",
    NOT_APPLICABLE: "bg-gray-100 text-gray-600",
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
      >
        <Plus className="h-3.5 w-3.5" /> Import Controls
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
          <div className="relative z-10 w-full max-w-3xl rounded-2xl bg-white dark:bg-gray-900 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b dark:border-gray-800 px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Import Controls</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Upload a CSV to create or update controls in bulk</p>
              </div>
              <button onClick={handleClose} className="rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-800">
                <X className="h-5 w-5 dark:text-gray-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {result ? (
                <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/40 p-6 text-center">
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">{result.created + result.updated}</p>
                  <p className="text-sm text-green-600 dark:text-green-500 mt-1">controls processed</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                    {result.created} new · {result.updated} updated
                  </p>
                  <button onClick={handleClose} className="mt-4 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">
                    Done
                  </button>
                </div>
              ) : (
                <>
                  {/* Upload area */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Upload CSV File</p>
                      <button type="button" onClick={downloadTemplate} className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                        <Download className="h-3 w-3" /> Download template
                      </button>
                    </div>
                    <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-6 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors">
                      <Upload className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {csvContent
                          ? `✓ CSV loaded — ${preview.length} controls ready`
                          : "Click to upload CSV"}
                      </span>
                      <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                    </label>
                  </div>

                  {/* CSV column guide */}
                  <div className="rounded-lg border dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">CSV Columns</p>
                    <div className="grid grid-cols-2 gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <span><span className="font-mono text-blue-600 dark:text-blue-400">controlCode</span> — unique ID (e.g. NYPL-001)</span>
                      <span><span className="font-mono text-blue-600 dark:text-blue-400">title</span> — short control name</span>
                      <span><span className="font-mono text-blue-600 dark:text-blue-400">description</span> — what the control does</span>
                      <span><span className="font-mono text-blue-600 dark:text-blue-400">status</span> — IMPLEMENTED / IN_PROGRESS / NOT_STARTED</span>
                      <span><span className="font-mono text-blue-600 dark:text-blue-400">owner</span> — responsible team or person</span>
                      <span><span className="font-mono text-blue-600 dark:text-blue-400">category</span> — control category</span>
                      <span className="col-span-2"><span className="font-mono text-blue-600 dark:text-blue-400">tags</span> — semicolon-separated tags (e.g. mfa;identity;access)</span>
                    </div>
                  </div>

                  {/* Preview table */}
                  {preview.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Preview — {preview.length} controls</p>
                      <div className="overflow-x-auto rounded-lg border dark:border-gray-700 max-h-64">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Code</th>
                              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Title</th>
                              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Status</th>
                              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Owner</th>
                              <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Category</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y dark:divide-gray-800">
                            {preview.map((ctrl, i) => (
                              <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                <td className="px-3 py-2 font-mono font-bold text-gray-700 dark:text-gray-300">{ctrl.controlCode}</td>
                                <td className="px-3 py-2 text-gray-900 dark:text-gray-100 max-w-xs truncate">{ctrl.title}</td>
                                <td className="px-3 py-2">
                                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[ctrl.status] ?? "bg-gray-100 text-gray-600"}`}>
                                    {ctrl.status}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{ctrl.owner || "—"}</td>
                                <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{ctrl.category || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {error && (
                    <p className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                      {error}
                    </p>
                  )}
                </>
              )}
            </div>

            {!result && (
              <div className="flex gap-3 border-t dark:border-gray-800 px-6 py-4">
                <button type="button" onClick={handleClose} className="flex-1 rounded-lg border dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isPending || preview.length === 0}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Import {preview.length > 0 ? `${preview.length} Controls` : "Controls"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
