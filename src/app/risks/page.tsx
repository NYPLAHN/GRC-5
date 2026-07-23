"use client";

import { useState, useEffect, useTransition } from "react";
import Header from "@/components/layout/Header";
import { AlertTriangle, Plus, X, ChevronDown, ChevronUp, Loader2, Sparkles, Pencil } from "lucide-react";
import { cn, getRiskRating, getRiskBadgeClasses, computeRiskScore } from "@/lib/utils";

type RiskRow = {
  id: string;
  riskId: string;
  title: string;
  description: string;
  category: string | null;
  owner: string | null;
  likelihood: string;
  impact: string;
  velocity: string;
  inherentScore: number;
  residualScore: number;
  treatment: string;
  treatmentDetails: string | null;
  isOpen: boolean;
};

const LIKELIHOOD_OPTS = ["RARE", "UNLIKELY", "POSSIBLE", "LIKELY", "ALMOST_CERTAIN"];
const IMPACT_OPTS = ["NEGLIGIBLE", "MINOR", "MODERATE", "MAJOR", "CRITICAL"];
const VELOCITY_OPTS = ["SLOW", "MEDIUM", "FAST"];
const TREATMENT_OPTS = ["MITIGATE", "TRANSFER", "ACCEPT", "AVOID"];

const LIKELIHOOD_LABELS: Record<string, string> = {
  RARE: "Rare (1)", UNLIKELY: "Unlikely (2)", POSSIBLE: "Possible (3)",
  LIKELY: "Likely (4)", ALMOST_CERTAIN: "Almost Certain (5)",
};
const IMPACT_LABELS: Record<string, string> = {
  NEGLIGIBLE: "Negligible (1)", MINOR: "Minor (2)", MODERATE: "Moderate (3)",
  MAJOR: "Major (4)", CRITICAL: "Critical (5)",
};

function RiskScoreCell({ score }: { score: number; type: "inherent" | "residual" }) {
  const rating = getRiskRating(score);
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={cn("rounded-full border px-2 py-0.5 text-xs font-semibold", getRiskBadgeClasses(rating))}>{score}</span>
      <span className={cn("text-[9px] font-medium", getRiskBadgeClasses(rating))}>{rating}</span>
    </div>
  );
}

// ─── Create/Edit Drawer ────────────────────────────────────────────────────────

function RiskDrawer({
  onClose,
  onSaved,
  editRisk,
}: {
  onClose: () => void;
  onSaved: (risk: RiskRow) => void;
  editRisk?: RiskRow;
}) {
  const isEdit = Boolean(editRisk);
  const [form, setForm] = useState({
    title: editRisk?.title ?? "",
    description: editRisk?.description ?? "",
    category: editRisk?.category ?? "",
    owner: editRisk?.owner ?? "",
    likelihood: editRisk?.likelihood ?? "POSSIBLE",
    impact: editRisk?.impact ?? "MODERATE",
    velocity: editRisk?.velocity ?? "MEDIUM",
    residualScore: editRisk?.residualScore ?? 5,
    treatment: editRisk?.treatment ?? "MITIGATE",
    treatmentDetails: editRisk?.treatmentDetails ?? "",
    isOpen: editRisk?.isOpen ?? true,
  });
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const inherent = computeRiskScore(form.likelihood, form.impact);
  const inherentRating = getRiskRating(inherent);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        const url = isEdit ? `/api/risks/${editRisk!.id}` : "/api/risks";
        const method = isEdit ? "PATCH" : "POST";
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, residualScore: Number(form.residualScore) }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? (isEdit ? "Failed to update risk" : "Failed to create risk"));
        onSaved(data.data);
        onClose();
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 h-full w-full max-w-lg overflow-y-auto bg-white dark:bg-gray-900 shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-4">
          <div>
            {isEdit && <p className="text-xs font-mono font-bold text-gray-400 dark:text-gray-500">{editRisk!.riskId}</p>}
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {isEdit ? "Edit Risk" : "New Risk"}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="h-5 w-5 dark:text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          {/* Score preview */}
          <div className={cn("rounded-xl border p-4 text-center", getRiskBadgeClasses(inherentRating))}>
            <p className="text-xs font-medium opacity-70">Computed Inherent Score</p>
            <p className="text-4xl font-bold">{inherent}</p>
            <p className="text-sm font-semibold">{inherentRating}</p>
            <p className="text-xs opacity-60 mt-1">Likelihood × Impact (auto-calculated)</p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Title *</label>
            <input required className="w-full rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Ransomware attack on critical servers" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Description *</label>
            <textarea required rows={3} className="w-full rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Describe the risk scenario..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Category</label>
              <input className="w-full rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Cybersecurity, Compliance..." />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Risk Owner</label>
              <input className="w-full rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.owner} onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))} placeholder="CISO, Security Team..." />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { key: "likelihood", label: "Likelihood *", opts: LIKELIHOOD_OPTS, labels: LIKELIHOOD_LABELS },
              { key: "impact", label: "Impact *", opts: IMPACT_OPTS, labels: IMPACT_LABELS },
              { key: "velocity", label: "Velocity *", opts: VELOCITY_OPTS, labels: {} },
            ].map(({ key, label, opts, labels }) => (
              <div key={key}>
                <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">{label}</label>
                <select required className="w-full rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" value={(form as any)[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}>
                  {opts.map((o) => <option key={o} value={o}>{(labels as any)[o] ?? o}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Residual Score (1–25) * <span className="font-normal text-gray-400">after controls applied</span></label>
            <input required type="number" min={1} max={25} className="w-full rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.residualScore} onChange={(e) => setForm((f) => ({ ...f, residualScore: Number(e.target.value) }))} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Treatment *</label>
            <div className="grid grid-cols-2 gap-2">
              {TREATMENT_OPTS.map((t) => (
                <button key={t} type="button" onClick={() => setForm((f) => ({ ...f, treatment: t }))}
                  className={cn("rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                    form.treatment === t
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                      : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                  )}>{t}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Treatment Plan Details</label>
            <textarea rows={3} className="w-full rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.treatmentDetails} onChange={(e) => setForm((f) => ({ ...f, treatmentDetails: e.target.value }))} placeholder="Describe specific controls, timelines, and owners..." />
          </div>

          {isEdit && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Risk Status</label>
              <div className="flex gap-2">
                {[true, false].map((open) => (
                  <button
                    key={String(open)}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, isOpen: open }))}
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                      form.isOpen === open
                        ? open
                          ? "border-orange-400 bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300"
                          : "border-green-400 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300"
                        : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                    )}
                  >
                    {open ? "Open" : "Closed"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <p className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex gap-3 border-t dark:border-gray-800 pt-4">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">Cancel</button>
            <button type="submit" disabled={isPending} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Create Risk"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Generate from Assessment Modal ──────────────────────────────────────────

type Assessment = { id: string; title: string; startDate: string };

function GenerateRisksModal({
  onClose,
  onGenerated,
}: {
  onClose: () => void;
  onGenerated: (risks: RiskRow[]) => void;
}) {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loadingAssessments, setLoadingAssessments] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ created: number } | null>(null);

  useEffect(() => {
    fetch("/api/assessments")
      .then((r) => r.json())
      .then((d) => {
        setAssessments(d.data ?? []);
        if (d.data?.length > 0) setSelectedId(d.data[0].id);
      })
      .finally(() => setLoadingAssessments(false));
  }, []);

  function handleGenerate() {
    if (!selectedId) return;
    setError("");
    startTransition(async () => {
      try {
        const res = await fetch("/api/risks/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assessmentId: selectedId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to generate risks");
        setResult({ created: data.data.created });
        onGenerated(data.data.risks ?? []);
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-2xl">
        <div className="flex items-center justify-between border-b dark:border-gray-800 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Generate Risks from Assessment</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Creates risk entries for every NON_COMPLIANT and PARTIAL finding
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="h-5 w-5 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {result ? (
            <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/40 p-6 text-center">
              <p className="text-3xl font-bold text-green-700 dark:text-green-400">{result.created}</p>
              <p className="text-sm text-green-600 dark:text-green-500 mt-1">
                {result.created === 0 ? "No gaps found — all controls compliant!" : "risks generated from compliance gaps"}
              </p>
              <button onClick={onClose} className="mt-4 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">
                Done
              </button>
            </div>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Select Assessment *
                </label>
                {loadingAssessments ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading assessments...
                  </div>
                ) : assessments.length === 0 ? (
                  <p className="text-sm text-red-500">No assessments found. Upload an assessment first.</p>
                ) : (
                  <select
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value)}
                    className="w-full rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {assessments.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title} · {new Date(a.startDate).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="rounded-lg border dark:border-gray-700 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 p-3">
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  This will create one risk entry per NON_COMPLIANT or PARTIAL control in the selected assessment.
                  Risks are scored automatically based on compliance status and linked back to the source control.
                </p>
              </div>

              {error && (
                <p className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} className="flex-1 rounded-lg border dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
                  Cancel
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={isPending || !selectedId || loadingAssessments}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Generate Risks
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RisksPage() {
  const [risks, setRisks] = useState<RiskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDrawer, setShowDrawer] = useState(false);
  const [editRisk, setEditRisk] = useState<RiskRow | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [sortField, setSortField] = useState<"inherentScore" | "residualScore" | "riskId">("inherentScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    fetch("/api/risks").then((r) => r.json()).then((d) => setRisks(d.data ?? [])).finally(() => setLoading(false));
  }, []);

  function handleSort(field: typeof sortField) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
  }

  function handleSaved(updated: RiskRow) {
    setRisks((prev) => {
      const exists = prev.find((r) => r.id === updated.id);
      return exists
        ? prev.map((r) => (r.id === updated.id ? updated : r))
        : [updated, ...prev];
    });
  }

  const sorted = [...risks].sort((a, b) => {
    const av = (a as any)[sortField];
    const bv = (b as any)[sortField];
    const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });

  const SortIcon = ({ field }: { field: typeof sortField }) =>
    sortField === field ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : null;

  const TREATMENT_COLORS: Record<string, string> = {
    MITIGATE: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
    TRANSFER: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
    ACCEPT: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800",
    AVOID: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
  };

  return (
    <>
      <Header title="Risk Register" subtitle="Identify, score, and treat organizational risks" />
      <main className="grc-page space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((rating) => {
            const count = risks.filter((r) => getRiskRating(r.inherentScore) === rating).length;
            return (
              <div key={rating} className={cn("flex items-center gap-3 rounded-xl border p-4", getRiskBadgeClasses(rating))}>
                <AlertTriangle className="h-5 w-5" />
                <div>
                  <p className="text-xl font-bold">{count}</p>
                  <p className="text-xs font-medium">{rating}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="overflow-hidden rounded-xl border dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <div className="flex items-center justify-between border-b dark:border-gray-800 px-6 py-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Risk Register ({risks.length} risks)</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowGenerateModal(true)}
                className="flex items-center gap-2 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-900 px-3 py-2 text-xs font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40"
              >
                <Sparkles className="h-3.5 w-3.5" /> Generate from Assessment
              </button>
              <button onClick={() => setShowDrawer(true)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">
                <Plus className="h-3.5 w-3.5" /> New Risk
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th className="cursor-pointer select-none" onClick={() => handleSort("riskId")}><span className="flex items-center gap-1">Risk ID <SortIcon field="riskId" /></span></th>
                  <th>Title & Category</th>
                  <th>Owner</th>
                  <th>L × I</th>
                  <th>Velocity</th>
                  <th className="cursor-pointer select-none" onClick={() => handleSort("inherentScore")}><span className="flex items-center gap-1">Inherent <SortIcon field="inherentScore" /></span></th>
                  <th className="cursor-pointer select-none" onClick={() => handleSort("residualScore")}><span className="flex items-center gap-1">Residual <SortIcon field="residualScore" /></span></th>
                  <th>Treatment</th>
                  <th>Status</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10} className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-300" /></td></tr>
                ) : sorted.length === 0 ? (
                  <tr><td colSpan={10} className="py-16 text-center text-sm text-gray-400 dark:text-gray-500">No risks in the register. Add your first risk.</td></tr>
                ) : (
                  sorted.map((risk) => (
                    <tr key={risk.id}>
                      <td className="font-mono text-xs font-bold text-gray-500 dark:text-gray-400">{risk.riskId}</td>
                      <td>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{risk.title}</p>
                        {risk.category && <p className="text-xs text-gray-400 dark:text-gray-500">{risk.category}</p>}
                      </td>
                      <td className="text-sm text-gray-600 dark:text-gray-400">{risk.owner ?? "—"}</td>
                      <td className="text-xs text-gray-500 dark:text-gray-400">{risk.likelihood.slice(0, 3).toUpperCase()} × {risk.impact.slice(0, 3).toUpperCase()}</td>
                      <td>
                        <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-medium",
                          risk.velocity === "FAST" ? "bg-red-50 border-red-200 text-red-600 dark:bg-red-950 dark:border-red-800 dark:text-red-400"
                            : risk.velocity === "MEDIUM" ? "bg-yellow-50 border-yellow-200 text-yellow-600 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-400"
                            : "bg-green-50 border-green-200 text-green-600 dark:bg-green-950 dark:border-green-800 dark:text-green-400"
                        )}>{risk.velocity}</span>
                      </td>
                      <td className="text-center"><RiskScoreCell score={risk.inherentScore} type="inherent" /></td>
                      <td className="text-center"><RiskScoreCell score={risk.residualScore} type="residual" /></td>
                      <td>
                        <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold", TREATMENT_COLORS[risk.treatment] ?? "bg-gray-100 text-gray-600")}>{risk.treatment}</span>
                      </td>
                      <td>
                        <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium",
                          risk.isOpen
                            ? "bg-orange-50 border-orange-200 text-orange-600 dark:bg-orange-950 dark:border-orange-800 dark:text-orange-400"
                            : "bg-green-50 border-green-200 text-green-600 dark:bg-green-950 dark:border-green-800 dark:text-green-400"
                        )}>{risk.isOpen ? "Open" : "Closed"}</span>
                      </td>
                      <td>
                        <button
                          onClick={() => setEditRisk(risk)}
                          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {showDrawer && (
        <RiskDrawer
          onClose={() => setShowDrawer(false)}
          onSaved={handleSaved}
        />
      )}
      {editRisk && (
        <RiskDrawer
          editRisk={editRisk}
          onClose={() => setEditRisk(null)}
          onSaved={handleSaved}
        />
      )}
      {showGenerateModal && (
        <GenerateRisksModal
          onClose={() => setShowGenerateModal(false)}
          onGenerated={(newRisks) => setRisks((prev) => [...newRisks, ...prev])}
        />
      )}
    </>
  );
}
