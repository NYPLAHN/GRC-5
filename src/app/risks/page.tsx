"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import Header from "@/components/layout/Header";
import {
  AlertTriangle, Plus, X, ChevronDown, ChevronUp, Loader2, Sparkles, Pencil,
  ShieldAlert, Search, FilterX, CalendarClock, Wrench, CheckCircle2,
} from "lucide-react";
import InfoTip from "@/components/ui/InfoTip";
import {
  cn, getRiskRating, getRiskBadgeClasses, computeRiskScore, formatDate,
  getRiskSourceClasses, RISK_SOURCE_LABELS, CADENCE_LABELS,
  getLikelihoodClasses, getImpactClasses,
} from "@/lib/utils";

type RiskRow = {
  id: string;
  riskId: string;
  title: string;
  description: string;
  category: string | null;
  owner: string | null;
  riskLead: string | null;
  source: string;
  likelihood: string;
  impact: string;
  velocity: string;
  inherentScore: number;
  residualScore: number;
  treatment: string;
  treatmentDetails: string | null;
  isOpen: boolean;
  isException: boolean;
  exceptionJustification: string | null;
  exceptionApprovedBy: string | null;
  exceptionReviewCadence: string | null;
  exceptionNextReview: string | null;
};

const LIKELIHOOD_OPTS = ["RARE", "UNLIKELY", "POSSIBLE", "LIKELY", "ALMOST_CERTAIN"];
const IMPACT_OPTS = ["NEGLIGIBLE", "MINOR", "MODERATE", "MAJOR", "CRITICAL"];
const VELOCITY_OPTS = ["SLOW", "MEDIUM", "FAST"];
const TREATMENT_OPTS = ["MITIGATE", "TRANSFER", "ACCEPT", "AVOID"];
const SOURCE_OPTS = Object.keys(RISK_SOURCE_LABELS);
const CADENCE_OPTS = Object.keys(CADENCE_LABELS);

const LIKELIHOOD_LABELS: Record<string, string> = {
  RARE: "Rare (1)", UNLIKELY: "Unlikely (2)", POSSIBLE: "Possible (3)",
  LIKELY: "Likely (4)", ALMOST_CERTAIN: "Almost Certain (5)",
};
const IMPACT_LABELS: Record<string, string> = {
  NEGLIGIBLE: "Negligible (1)", MINOR: "Minor (2)", MODERATE: "Moderate (3)",
  MAJOR: "Major (4)", CRITICAL: "Critical (5)",
};

const TREATMENT_COLORS: Record<string, string> = {
  MITIGATE: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  TRANSFER: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
  ACCEPT: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800",
  AVOID: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
};

const inputCls =
  "w-full rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

const SCORING_TIPS: Record<string, string> = {
  likelihood: "How probable the risk scenario is within ~12 months: Rare (1) = very unlikely, Unlikely (2), Possible (3), Likely (4), Almost Certain (5) = expected to occur.",
  impact: "Severity of consequences if the risk materializes, from Negligible (1) to Critical (5) — consider financial, operational, reputational, and patron-data harm.",
  velocity: "The speed at which the risk impacts the organization once triggered: Slow = days/weeks of warning, Medium = hours to days, Fast = immediate, no reaction time.",
  residual: "Remaining risk AFTER controls and treatment are applied. Inherent score = Likelihood × Impact (1–25); lower it to reflect how effective your controls are. Example: inherent 16 with strong MFA + monitoring might leave residual 6.",
  inherent: "Auto-calculated: Likelihood (1–5) × Impact (1–5) = 1–25, BEFORE any controls. ≥15 Critical, ≥10 High, ≥5 Medium, <5 Low.",
};
const filterCls =
  "w-full rounded-md border dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 px-2 py-1 text-[11px] font-normal focus:outline-none focus:ring-1 focus:ring-blue-500";

/** Bubbly, color-coded score pill (matches velocity/treatment styling) */
function RiskScorePill({ score }: { score: number }) {
  const rating = getRiskRating(score);
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold whitespace-nowrap",
      getRiskBadgeClasses(rating)
    )}>
      {score}
      <span className="font-semibold opacity-80">· {rating}</span>
    </span>
  );
}

type UserOption = { id: string; name: string | null; email: string };
type LinkedRemediation = {
  id: string;
  title: string;
  status: string;
  priority: number;
  assignee: { name: string | null; email: string };
};

const REM_STATUS_LABELS: Record<string, string> = {
  OPEN: "Open", IN_PROGRESS: "In Progress", RESOLVED: "Resolved", WONT_FIX: "Won't Fix",
};

/** Linked remediations list + quick-create, shown inside the risk drawer (edit mode). */
function RiskRemediationSection({ risk }: { risk: RiskRow }) {
  const [remediations, setRemediations] = useState<LinkedRemediation[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState(`Remediate: ${risk.title}`);
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/remediation?riskId=${risk.id}`).then((r) => r.json()),
      fetch("/api/users").then((r) => r.json()),
    ]).then(([remData, userData]) => {
      setRemediations(remData.data ?? []);
      const u = userData.data ?? [];
      setUsers(u);
      if (u.length > 0) setAssignedTo(u[0].id);
    }).finally(() => setLoading(false));
  }, [risk.id]);

  function handleCreate() {
    if (!title.trim() || !assignedTo) return;
    setError("");
    startTransition(async () => {
      try {
        const rating = getRiskRating(risk.inherentScore);
        const priority = rating === "CRITICAL" ? 1 : rating === "HIGH" ? 2 : rating === "MEDIUM" ? 3 : 4;
        const res = await fetch("/api/remediation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            description: risk.treatmentDetails?.trim() || `Remediation for ${risk.riskId}: ${risk.description}`,
            riskId: risk.id,
            assignedTo,
            priority,
            ...(dueDate ? { dueDate } : {}),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to create remediation");
        setRemediations((prev) => [data.data, ...prev]);
        setShowForm(false);
        setTitle(`Remediate: ${risk.title}`);
        setDueDate("");
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  return (
    <div className="rounded-xl border dark:border-gray-700 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-gray-200">
          <Wrench className="h-4 w-4 text-blue-500" /> Linked Remediations
          {!loading && <span className="text-xs font-normal text-gray-400">({remediations.length})</span>}
        </p>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700"
          >
            <Plus className="h-3 w-3" /> Create Remediation
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-2 text-xs text-gray-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...</div>
      ) : remediations.length === 0 && !showForm ? (
        <p className="text-xs text-gray-400 dark:text-gray-500">No remediations linked to this risk yet.</p>
      ) : (
        <div className="space-y-1.5">
          {remediations.map((rem) => (
            <div key={rem.id} className="flex items-center justify-between gap-2 rounded-lg border dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-gray-800 dark:text-gray-200">{rem.title}</p>
                <p className="text-[10px] text-gray-400">{rem.assignee?.name ?? rem.assignee?.email}</p>
              </div>
              <span className={cn(
                "flex-shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium whitespace-nowrap",
                rem.status === "RESOLVED"
                  ? "bg-green-50 border-green-200 text-green-600 dark:bg-green-950 dark:border-green-800 dark:text-green-400"
                  : rem.status === "IN_PROGRESS"
                  ? "bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-400"
                  : "bg-orange-50 border-orange-200 text-orange-600 dark:bg-orange-950 dark:border-orange-800 dark:text-orange-400"
              )}>
                {rem.status === "RESOLVED" && <CheckCircle2 className="mr-0.5 inline h-2.5 w-2.5" />}
                {REM_STATUS_LABELS[rem.status] ?? rem.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="space-y-2.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 p-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-gray-700 dark:text-gray-300">Title *</label>
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-gray-700 dark:text-gray-300">Assignee *</label>
              <select className={inputCls} value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name ?? u.email}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-gray-700 dark:text-gray-300">Due Date</label>
              <input type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">
            Priority is set automatically from this risk&apos;s inherent rating; the description pulls from the treatment plan. Both are editable in the Remediation tracker.
          </p>
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border dark:border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800">Cancel</button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={isPending || !title.trim() || !assignedTo}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              Create & Link
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RiskDrawer({ onClose, onSaved, editRisk }: {
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
    riskLead: editRisk?.riskLead ?? "",
    source: editRisk?.source ?? "SELF_IDENTIFIED",
    likelihood: editRisk?.likelihood ?? "POSSIBLE",
    impact: editRisk?.impact ?? "MODERATE",
    velocity: editRisk?.velocity ?? "MEDIUM",
    residualScore: editRisk?.residualScore ?? 5,
    treatment: editRisk?.treatment ?? "MITIGATE",
    treatmentDetails: editRisk?.treatmentDetails ?? "",
    isOpen: editRisk?.isOpen ?? true,
    isException: editRisk?.isException ?? false,
    exceptionJustification: editRisk?.exceptionJustification ?? "",
    exceptionApprovedBy: editRisk?.exceptionApprovedBy ?? "",
    exceptionReviewCadence: editRisk?.exceptionReviewCadence ?? "QUARTERLY",
    exceptionNextReview: editRisk?.exceptionNextReview?.slice(0, 10) ?? "",
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
        const payload: any = {
          ...form,
          residualScore: Number(form.residualScore),
        };
        if (!payload.isException) {
          payload.exceptionJustification = "";
          payload.exceptionApprovedBy = "";
          delete payload.exceptionReviewCadence;
          delete payload.exceptionNextReview;
        } else if (!payload.exceptionNextReview) {
          delete payload.exceptionNextReview;
        }
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
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
      <div className="relative z-10 h-full w-full max-w-xl overflow-y-auto bg-white dark:bg-gray-900 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-4">
          <div>
            {isEdit && <p className="text-xs font-mono font-bold text-gray-400 dark:text-gray-500">{editRisk!.riskId}</p>}
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{isEdit ? "Edit Risk" : "New Risk"}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="h-5 w-5 dark:text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div className={cn("rounded-xl border p-4 text-center", getRiskBadgeClasses(inherentRating))}>
            <p className="flex items-center justify-center gap-1 text-xs font-medium opacity-70">
              Computed Inherent Score <InfoTip text={SCORING_TIPS.inherent} />
            </p>
            <p className="text-4xl font-bold">{inherent}</p>
            <p className="text-sm font-semibold">{inherentRating}</p>
            <p className="text-xs opacity-60 mt-1">Likelihood × Impact (auto-calculated)</p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Title *</label>
            <input required className={inputCls} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Ransomware attack on critical servers" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Description *</label>
            <textarea required rows={6} className={cn(inputCls, "resize-y min-h-[120px]")} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Describe the risk scenario, affected assets, and potential business impact..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Category</label>
              <input className={inputCls} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Cybersecurity, Compliance..." />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Risk Source *</label>
              <select required className={inputCls} value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}>
                {SOURCE_OPTS.map((s) => <option key={s} value={s}>{RISK_SOURCE_LABELS[s]}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Risk Owner <span className="font-normal text-gray-400">accountable</span></label>
              <input className={inputCls} value={form.owner} onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))} placeholder="CISO, Security Team..." />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Risk Lead <span className="font-normal text-gray-400">reports & remediates</span></label>
              <input className={inputCls} value={form.riskLead} onChange={(e) => setForm((f) => ({ ...f, riskLead: e.target.value }))} placeholder="e.g. Jane Smith" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { key: "likelihood", label: "Likelihood *", opts: LIKELIHOOD_OPTS, labels: LIKELIHOOD_LABELS },
              { key: "impact", label: "Impact *", opts: IMPACT_OPTS, labels: IMPACT_LABELS },
              { key: "velocity", label: "Velocity *", opts: VELOCITY_OPTS, labels: {} },
            ].map(({ key, label, opts, labels }) => (
              <div key={key}>
                <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-gray-700 dark:text-gray-300">
                  {label} <InfoTip text={SCORING_TIPS[key]} />
                </label>
                <select required className="w-full rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" value={(form as any)[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}>
                  {opts.map((o) => <option key={o} value={o}>{(labels as any)[o] ?? o}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div>
            <label className="mb-1 flex items-center gap-1 text-xs font-semibold text-gray-700 dark:text-gray-300">
              Residual Score (1–25) * <span className="font-normal text-gray-400">after controls applied</span> <InfoTip text={SCORING_TIPS.residual} />
            </label>
            <input required type="number" min={1} max={25} className={inputCls} value={form.residualScore} onChange={(e) => setForm((f) => ({ ...f, residualScore: Number(e.target.value) }))} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Treatment *</label>
            <div className="grid grid-cols-2 gap-2">
              {TREATMENT_OPTS.map((t) => (
                <button key={t} type="button" onClick={() => setForm((f) => ({ ...f, treatment: t }))}
                  className={cn("rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                    form.treatment === t
                      ? TREATMENT_COLORS[t] + " ring-1 ring-current"
                      : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                  )}>{t}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Treatment Plan Details</label>
            <textarea rows={6} className={cn(inputCls, "resize-y min-h-[120px]")} value={form.treatmentDetails} onChange={(e) => setForm((f) => ({ ...f, treatmentDetails: e.target.value }))} placeholder="Describe specific controls, timelines, and owners..." />
          </div>

          {/* Risk exception */}
          <div className={cn("rounded-xl border p-4 space-y-3 transition-colors", form.isException ? "border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/30" : "dark:border-gray-700")}>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-amber-600"
                checked={form.isException}
                onChange={(e) => setForm((f) => ({ ...f, isException: e.target.checked }))}
              />
              <div>
                <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-gray-200">
                  <ShieldAlert className="h-4 w-4 text-amber-500" /> Risk Exception
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Formally accept this risk for a period, with a defined review cadence.
                </p>
              </div>
            </label>

            {form.isException && (
              <div className="space-y-3 pt-1">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Justification *</label>
                  <textarea required rows={3} className={cn(inputCls, "resize-y")} value={form.exceptionJustification} onChange={(e) => setForm((f) => ({ ...f, exceptionJustification: e.target.value }))} placeholder="Business justification for accepting this risk..." />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Approved By</label>
                    <input className={inputCls} value={form.exceptionApprovedBy} onChange={(e) => setForm((f) => ({ ...f, exceptionApprovedBy: e.target.value }))} placeholder="CISO" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Review Cadence *</label>
                    <select className={inputCls} value={form.exceptionReviewCadence} onChange={(e) => setForm((f) => ({ ...f, exceptionReviewCadence: e.target.value }))}>
                      {CADENCE_OPTS.map((c) => <option key={c} value={c}>{CADENCE_LABELS[c]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Next Review</label>
                    <input type="date" className={inputCls} value={form.exceptionNextReview} onChange={(e) => setForm((f) => ({ ...f, exceptionNextReview: e.target.value }))} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {isEdit && <RiskRemediationSection risk={editRisk!} />}

          {isEdit && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Risk Status</label>
              <div className="flex gap-2">
                {[true, false].map((open) => (
                  <button key={String(open)} type="button" onClick={() => setForm((f) => ({ ...f, isOpen: open }))}
                    className={cn("flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                      form.isOpen === open
                        ? open
                          ? "border-orange-400 bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300"
                          : "border-green-400 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300"
                        : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                    )}>{open ? "Open" : "Closed"}</button>
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

type Assessment = { id: string; title: string; startDate: string };

function GenerateRisksModal({ onClose, onGenerated }: {
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
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Creates risk entries for every NON_COMPLIANT and PARTIAL finding</p>
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
              <button onClick={onClose} className="mt-4 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">Done</button>
            </div>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Select Assessment *</label>
                {loadingAssessments ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                  </div>
                ) : assessments.length === 0 ? (
                  <p className="text-sm text-red-500">No assessments found. Upload an assessment first.</p>
                ) : (
                  <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className={inputCls}>
                    {assessments.map((a) => (
                      <option key={a.id} value={a.id}>{a.title} · {new Date(a.startDate).toLocaleDateString()}</option>
                    ))}
                  </select>
                )}
              </div>
              <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3">
                <p className="text-xs text-amber-700 dark:text-amber-400">Creates one risk per NON_COMPLIANT or PARTIAL control. Scores are calculated automatically from compliance status.</p>
              </div>
              {error && <p className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} className="flex-1 rounded-lg border dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">Cancel</button>
                <button onClick={handleGenerate} disabled={isPending || !selectedId || loadingAssessments} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
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

export default function RisksPage() {
  const [risks, setRisks] = useState<RiskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showDrawer, setShowDrawer] = useState(false);
  const [editRisk, setEditRisk] = useState<RiskRow | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [sortField, setSortField] = useState<"inherentScore" | "residualScore" | "riskId">("inherentScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Filters
  const [ratingFilter, setRatingFilter] = useState<string>("");
  const [exceptionFilter, setExceptionFilter] = useState(false);
  const [idFilter, setIdFilter] = useState("");
  const [textFilter, setTextFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [leadFilter, setLeadFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [treatmentFilter, setTreatmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    fetch("/api/risks")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? `Failed to load risks (HTTP ${r.status})`);
        setRisks(d.data ?? []);
      })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function handleSort(field: typeof sortField) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
  }

  function handleSaved(updated: RiskRow) {
    setRisks((prev) => {
      const exists = prev.find((r) => r.id === updated.id);
      return exists ? prev.map((r) => (r.id === updated.id ? updated : r)) : [updated, ...prev];
    });
  }

  const owners = useMemo(() => Array.from(new Set(risks.map((r) => r.owner).filter(Boolean))).sort() as string[], [risks]);
  const leads = useMemo(() => Array.from(new Set(risks.map((r) => r.riskLead).filter(Boolean))).sort() as string[], [risks]);

  const hasFilters = Boolean(ratingFilter || exceptionFilter || idFilter || textFilter || ownerFilter || leadFilter || sourceFilter || treatmentFilter || statusFilter);

  const filtered = risks.filter((r) => {
    if (ratingFilter && getRiskRating(r.inherentScore) !== ratingFilter) return false;
    if (exceptionFilter && !r.isException) return false;
    if (idFilter && !r.riskId.toLowerCase().includes(idFilter.toLowerCase())) return false;
    if (textFilter) {
      const q = textFilter.toLowerCase();
      if (!r.title.toLowerCase().includes(q) && !(r.category ?? "").toLowerCase().includes(q) && !r.description.toLowerCase().includes(q)) return false;
    }
    if (ownerFilter && r.owner !== ownerFilter) return false;
    if (leadFilter && r.riskLead !== leadFilter) return false;
    if (sourceFilter && r.source !== sourceFilter) return false;
    if (treatmentFilter && r.treatment !== treatmentFilter) return false;
    if (statusFilter === "OPEN" && !r.isOpen) return false;
    if (statusFilter === "CLOSED" && r.isOpen) return false;
    if (statusFilter === "EXCEPTION" && !r.isException) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const av = (a as any)[sortField];
    const bv = (b as any)[sortField];
    const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });

  function clearFilters() {
    setRatingFilter(""); setExceptionFilter(false); setIdFilter(""); setTextFilter("");
    setOwnerFilter(""); setLeadFilter(""); setSourceFilter(""); setTreatmentFilter(""); setStatusFilter("");
  }

  const SortIcon = ({ field }: { field: typeof sortField }) =>
    sortField === field ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : null;

  const exceptionCount = risks.filter((r) => r.isException).length;
  const overdueReviews = risks.filter(
    (r) => r.isException && r.exceptionNextReview && new Date(r.exceptionNextReview) < new Date()
  ).length;

  return (
    <>
      <Header title="Risk Register" subtitle="Identify, score, and treat organizational risks" />
      <main className="grc-page space-y-6">
        {loadError && (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-5 py-4 text-sm text-red-700 dark:text-red-400">
            <strong>Couldn&apos;t load risks:</strong> {loadError}
            <button onClick={() => window.location.reload()} className="ml-3 rounded-lg border border-red-300 dark:border-red-700 px-2.5 py-1 text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900">Retry</button>
          </div>
        )}

        {/* Clickable rating cards + exceptions */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((rating) => {
            const count = risks.filter((r) => getRiskRating(r.inherentScore) === rating).length;
            const active = ratingFilter === rating;
            return (
              <button
                key={rating}
                onClick={() => setRatingFilter(active ? "" : rating)}
                title={active ? "Click to clear filter" : `Filter table by ${rating} risks`}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-4 text-left transition-all cursor-pointer hover:shadow-md",
                  getRiskBadgeClasses(rating),
                  active && "ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-gray-950"
                )}
              >
                <AlertTriangle className="h-5 w-5" />
                <div>
                  <p className="text-xl font-bold">{count}</p>
                  <p className="text-xs font-medium">{rating}</p>
                </div>
              </button>
            );
          })}
          <button
            onClick={() => setExceptionFilter(!exceptionFilter)}
            title={exceptionFilter ? "Click to clear filter" : "Filter table by exceptions"}
            className={cn(
              "flex items-center gap-3 rounded-xl border p-4 text-left transition-all cursor-pointer hover:shadow-md",
              "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800",
              exceptionFilter && "ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-gray-950"
            )}
          >
            <ShieldAlert className="h-5 w-5" />
            <div>
              <p className="text-xl font-bold">{exceptionCount}</p>
              <p className="text-xs font-medium">EXCEPTIONS{overdueReviews > 0 ? ` · ${overdueReviews} overdue` : ""}</p>
            </div>
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <div className="flex items-center justify-between border-b dark:border-gray-800 px-6 py-4">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Risk Register ({sorted.length}{hasFilters ? ` of ${risks.length}` : ""} risks)
              </h2>
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 rounded-full border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 px-2.5 py-1 text-[11px] font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900"
                >
                  <FilterX className="h-3 w-3" /> Clear filters
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowGenerateModal(true)}
                className="flex items-center gap-2 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-900 px-3 py-2 text-xs font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40"
              >
                <Sparkles className="h-3.5 w-3.5" /> Generate from Assessment
              </button>
              <button
                onClick={() => setShowDrawer(true)}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                <Plus className="h-3.5 w-3.5" /> New Risk
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th className="cursor-pointer select-none" onClick={() => handleSort("riskId")}>
                    <span className="flex items-center gap-1">Risk ID <SortIcon field="riskId" /></span>
                  </th>
                  <th>Title & Category</th>
                  <th>Source</th>
                  <th>Owner / Lead</th>
                  <th><span className="flex items-center gap-1">L × I <InfoTip text="Likelihood and Impact ratings, each on a 1–5 scale. Hover the pills for full names; these multiply to give the inherent score." /></span></th>
                  <th><span className="flex items-center gap-1">Velocity <InfoTip text={SCORING_TIPS.velocity} /></span></th>
                  <th className="cursor-pointer select-none" onClick={() => handleSort("inherentScore")}>
                    <span className="flex items-center gap-1">Inherent <InfoTip text={SCORING_TIPS.inherent} /> <SortIcon field="inherentScore" /></span>
                  </th>
                  <th className="cursor-pointer select-none" onClick={() => handleSort("residualScore")}>
                    <span className="flex items-center gap-1">Residual <InfoTip text={SCORING_TIPS.residual} /> <SortIcon field="residualScore" /></span>
                  </th>
                  <th>Treatment</th>
                  <th>Status</th>
                  <th className="w-12"></th>
                </tr>
                {/* Header filter row */}
                <tr className="bg-gray-50/70 dark:bg-gray-800/40">
                  <th className="py-2 pr-2">
                    <input className={filterCls} placeholder="ID..." value={idFilter} onChange={(e) => setIdFilter(e.target.value)} />
                  </th>
                  <th className="py-2 pr-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
                      <input className={cn(filterCls, "pl-6")} placeholder="Search title, category..." value={textFilter} onChange={(e) => setTextFilter(e.target.value)} />
                    </div>
                  </th>
                  <th className="py-2 pr-2">
                    <select className={filterCls} value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
                      <option value="">All sources</option>
                      {SOURCE_OPTS.map((s) => <option key={s} value={s}>{RISK_SOURCE_LABELS[s]}</option>)}
                    </select>
                  </th>
                  <th className="py-2 pr-2">
                    <div className="flex flex-col gap-1">
                      <select className={filterCls} value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
                        <option value="">All owners</option>
                        {owners.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                      <select className={filterCls} value={leadFilter} onChange={(e) => setLeadFilter(e.target.value)}>
                        <option value="">All leads</option>
                        {leads.map((l) => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                  </th>
                  <th></th>
                  <th></th>
                  <th></th>
                  <th></th>
                  <th className="py-2 pr-2">
                    <select className={filterCls} value={treatmentFilter} onChange={(e) => setTreatmentFilter(e.target.value)}>
                      <option value="">All</option>
                      {TREATMENT_OPTS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </th>
                  <th className="py-2 pr-2">
                    <select className={filterCls} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                      <option value="">All</option>
                      <option value="OPEN">Open</option>
                      <option value="CLOSED">Closed</option>
                      <option value="EXCEPTION">Exception</option>
                    </select>
                  </th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={11} className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-300" /></td></tr>
                ) : sorted.length === 0 ? (
                  <tr><td colSpan={11} className="py-16 text-center text-sm text-gray-400 dark:text-gray-500">{hasFilters ? "No risks match the current filters." : "No risks in the register. Add your first risk."}</td></tr>
                ) : sorted.map((risk) => {
                  const reviewOverdue = risk.isException && risk.exceptionNextReview && new Date(risk.exceptionNextReview) < new Date();
                  return (
                    <tr
                      key={risk.id}
                      onClick={() => setEditRisk(risk)}
                      title="Click to open risk details"
                      className="cursor-pointer"
                    >
                      <td className="font-mono text-xs font-bold text-gray-500 dark:text-gray-400">{risk.riskId}</td>
                      <td>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{risk.title}</p>
                        {risk.category && <p className="text-xs text-gray-400 dark:text-gray-500">{risk.category}</p>}
                      </td>
                      <td>
                        <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap", getRiskSourceClasses(risk.source))}>
                          {RISK_SOURCE_LABELS[risk.source] ?? risk.source}
                        </span>
                      </td>
                      <td className="text-sm text-gray-600 dark:text-gray-400">
                        <p>{risk.owner ?? "—"}</p>
                        {risk.riskLead && <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">Lead: {risk.riskLead}</p>}
                      </td>
                      <td>
                        <div className="flex flex-col gap-1">
                          <span className={cn("inline-flex w-fit rounded-full border px-1.5 py-0.5 text-[9px] font-semibold", getLikelihoodClasses(risk.likelihood))}>
                            L: {risk.likelihood.replace("_", " ")}
                          </span>
                          <span className={cn("inline-flex w-fit rounded-full border px-1.5 py-0.5 text-[9px] font-semibold", getImpactClasses(risk.impact))}>
                            I: {risk.impact}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium",
                          risk.velocity === "FAST"
                            ? "bg-red-50 border-red-200 text-red-600 dark:bg-red-950 dark:border-red-800 dark:text-red-400"
                            : risk.velocity === "MEDIUM"
                            ? "bg-yellow-50 border-yellow-200 text-yellow-600 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-400"
                            : "bg-green-50 border-green-200 text-green-600 dark:bg-green-950 dark:border-green-800 dark:text-green-400"
                        )}>{risk.velocity}</span>
                      </td>
                      <td><RiskScorePill score={risk.inherentScore} /></td>
                      <td><RiskScorePill score={risk.residualScore} /></td>
                      <td>
                        <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold", TREATMENT_COLORS[risk.treatment] ?? "bg-gray-100 text-gray-600")}>{risk.treatment}</span>
                      </td>
                      <td>
                        <div className="flex flex-col gap-1">
                          <span className={cn("inline-flex w-fit rounded-full border px-2 py-0.5 text-[10px] font-medium",
                            risk.isOpen
                              ? "bg-orange-50 border-orange-200 text-orange-600 dark:bg-orange-950 dark:border-orange-800 dark:text-orange-400"
                              : "bg-green-50 border-green-200 text-green-600 dark:bg-green-950 dark:border-green-800 dark:text-green-400"
                          )}>{risk.isOpen ? "Open" : "Closed"}</span>
                          {risk.isException && (
                            <span
                              title={`${risk.exceptionReviewCadence ? CADENCE_LABELS[risk.exceptionReviewCadence] + " review" : "Exception"}${risk.exceptionNextReview ? ` · next: ${formatDate(risk.exceptionNextReview)}` : ""}`}
                              className={cn(
                                "inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap",
                                reviewOverdue
                                  ? "bg-red-50 border-red-200 text-red-600 dark:bg-red-950 dark:border-red-800 dark:text-red-400"
                                  : "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-400"
                              )}
                            >
                              {reviewOverdue ? <CalendarClock className="h-2.5 w-2.5" /> : <ShieldAlert className="h-2.5 w-2.5" />}
                              {reviewOverdue ? "Review overdue" : "Exception"}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditRisk(risk); }}
                          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {showDrawer && (
        <RiskDrawer onClose={() => setShowDrawer(false)} onSaved={handleSaved} />
      )}
      {editRisk && (
        <RiskDrawer editRisk={editRisk} onClose={() => setEditRisk(null)} onSaved={handleSaved} />
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
