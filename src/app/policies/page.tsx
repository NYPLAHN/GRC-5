"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import Header from "@/components/layout/Header";
import {
  ScrollText, Plus, X, Loader2, Search, FilterX, Upload, FileText,
  CheckCircle2, Clock, CalendarClock, Archive, History, ShieldCheck,
} from "lucide-react";
import { cn, formatDate, formatFileSize, timeAgo, CADENCE_LABELS } from "@/lib/utils";

type Revision = {
  id: string;
  version: string;
  summary: string;
  changedBy: string;
  createdAt: string;
};

type Policy = {
  id: string;
  policyCode: string;
  name: string;
  description: string | null;
  category: string | null;
  owner: string | null;
  status: string;
  version: string;
  effectiveDate: string | null;
  approvedBy: string | null;
  reviewCadence: string;
  lastReviewedAt: string | null;
  nextReviewDate: string | null;
  fileName: string | null;
  fileSize: number | null;
  storageKey: string | null;
  relatedControls: string[];
  revisions: Revision[];
};

type ControlOption = { id: string; controlCode: string; title: string };

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  APPROVED: { label: "Approved", icon: CheckCircle2, color: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-800" },
  IN_REVIEW: { label: "In Review", icon: Clock, color: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800" },
  DRAFT: { label: "Draft", icon: FileText, color: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-400 dark:border-yellow-800" },
  RETIRED: { label: "Retired", icon: Archive, color: "bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700" },
};

const CADENCE_OPTS = Object.keys(CADENCE_LABELS);

const inputCls =
  "w-full rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
const filterCls =
  "w-full rounded-md border dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 px-2 py-1 text-[11px] font-normal focus:outline-none focus:ring-1 focus:ring-blue-500";

function isReviewOverdue(p: Policy): boolean {
  return Boolean(p.status !== "RETIRED" && p.nextReviewDate && new Date(p.nextReviewDate) < new Date());
}

// ─── Drawer (create + edit) ─────────────────────────────────────

function PolicyDrawer({ policy, controls, onClose, onSaved }: {
  policy?: Policy;
  controls: ControlOption[];
  onClose: () => void;
  onSaved: (p: Policy) => void;
}) {
  const isEdit = Boolean(policy);
  const [form, setForm] = useState({
    name: policy?.name ?? "",
    description: policy?.description ?? "",
    category: policy?.category ?? "",
    owner: policy?.owner ?? "",
    status: policy?.status ?? "DRAFT",
    version: policy?.version ?? "1.0",
    effectiveDate: policy?.effectiveDate?.slice(0, 10) ?? "",
    approvedBy: policy?.approvedBy ?? "",
    reviewCadence: policy?.reviewCadence ?? "ANNUAL",
    nextReviewDate: policy?.nextReviewDate?.slice(0, 10) ?? "",
    fileName: policy?.fileName ?? "",
    fileSize: policy?.fileSize ?? 0,
    storageKey: policy?.storageKey ?? "",
  });
  const [related, setRelated] = useState<string[]>(policy?.relatedControls ?? []);
  const [revisionSummary, setRevisionSummary] = useState("");
  const [fileReplaced, setFileReplaced] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [reviewPending, startReviewTransition] = useTransition();
  const [error, setError] = useState("");

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setForm((f) => ({
      ...f,
      fileName: file.name,
      fileSize: file.size,
      storageKey: `policies/${Date.now()}-${file.name}`,
      name: f.name || file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
    }));
    setFileReplaced(true);
  }

  function toggleControl(code: string) {
    setRelated((prev) => prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]);
  }

  function buildPayload() {
    return {
      name: form.name,
      description: form.description || undefined,
      category: form.category || undefined,
      owner: form.owner || undefined,
      status: form.status,
      version: form.version,
      effectiveDate: form.effectiveDate || (isEdit ? null : undefined),
      approvedBy: form.approvedBy || undefined,
      reviewCadence: form.reviewCadence,
      nextReviewDate: form.nextReviewDate || (isEdit ? null : undefined),
      ...(form.fileName ? { fileName: form.fileName, fileSize: Number(form.fileSize) || undefined, storageKey: form.storageKey || undefined } : {}),
      relatedControls: related,
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        const url = isEdit ? `/api/policies/${policy!.id}` : "/api/policies";
        const method = isEdit ? "PATCH" : "POST";
        const payload: any = buildPayload();
        if (isEdit) {
          const versionChanged = form.version !== policy!.version;
          const summary = revisionSummary.trim()
            || (fileReplaced ? `Replaced document with "${form.fileName}"` : "")
            || (versionChanged ? `Updated to v${form.version}` : "");
          if (summary) payload.revisionSummary = summary;
        }
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to save policy");
        onSaved(data.data);
        onClose();
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  function handleMarkReviewed() {
    setError("");
    startReviewTransition(async () => {
      try {
        const res = await fetch(`/api/policies/${policy!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markReviewed: true, ...(revisionSummary.trim() ? { revisionSummary: revisionSummary.trim() } : {}) }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to record review");
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
            {isEdit && <p className="text-xs font-mono font-bold text-gray-400 dark:text-gray-500">{policy!.policyCode} · v{policy!.version}</p>}
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{isEdit ? "Policy Details" : "New Policy"}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="h-5 w-5 dark:text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          {/* Document upload */}
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-5 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors">
            <Upload className="h-6 w-6 text-gray-400 dark:text-gray-500" />
            <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">
              {form.fileName || "Upload the policy document (PDF, DOCX...)"}
            </span>
            {form.fileSize > 0 && (
              <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                {formatFileSize(Number(form.fileSize))}{isEdit && !fileReplaced ? " · current version on file" : ""}
              </span>
            )}
            {isEdit && form.fileName && <span className="text-[10px] text-gray-400">Click to replace with a new version</span>}
            <input type="file" className="hidden" onChange={handleFile} />
          </label>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Policy Name *</label>
            <input required className={inputCls} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Information Security Policy" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Purpose / Scope</label>
            <textarea rows={3} className={cn(inputCls, "resize-y")} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="What this policy covers and who it applies to..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Category</label>
              <input className={inputCls} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Access Control, Incident Response..." list="policy-categories" />
              <datalist id="policy-categories">
                {["Access Control", "Acceptable Use", "Incident Response", "Data Protection", "Business Continuity", "Vendor Management", "Security Awareness", "Change Management"].map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Owner</label>
              <input className={inputCls} value={form.owner} onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))} placeholder="CISO, IT Security..." />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="mb-2 block text-xs font-semibold text-gray-700 dark:text-gray-300">Status</label>
            <div className="grid grid-cols-4 gap-1.5">
              {Object.entries(STATUS_CONFIG).map(([value, conf]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, status: value }))}
                  className={cn(
                    "rounded-lg border px-2 py-2 text-[11px] font-semibold transition-colors",
                    form.status === value
                      ? conf.color + " ring-1 ring-current"
                      : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                  )}
                >
                  {conf.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Version</label>
              <input className={inputCls} value={form.version} onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))} placeholder="1.0" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Effective Date</label>
              <input type="date" className={inputCls} value={form.effectiveDate} onChange={(e) => setForm((f) => ({ ...f, effectiveDate: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Approved By</label>
              <input className={inputCls} value={form.approvedBy} onChange={(e) => setForm((f) => ({ ...f, approvedBy: e.target.value }))} placeholder="CISO" />
            </div>
          </div>

          {/* Review cadence */}
          <div className="rounded-xl border dark:border-gray-700 p-4 space-y-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
              <CalendarClock className="h-3.5 w-3.5 text-blue-500" /> Review Schedule
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[11px] text-gray-600 dark:text-gray-400">Cadence</label>
                <select className={inputCls} value={form.reviewCadence} onChange={(e) => setForm((f) => ({ ...f, reviewCadence: e.target.value }))}>
                  {CADENCE_OPTS.map((c) => <option key={c} value={c}>{CADENCE_LABELS[c]}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-gray-600 dark:text-gray-400">Next Review Due</label>
                <input type="date" className={inputCls} value={form.nextReviewDate} onChange={(e) => setForm((f) => ({ ...f, nextReviewDate: e.target.value }))} />
              </div>
            </div>
            {isEdit && (
              <div className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-2.5">
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  {policy!.lastReviewedAt ? `Last reviewed ${formatDate(policy!.lastReviewedAt)}` : "Never reviewed"}
                </p>
                <button
                  type="button"
                  onClick={handleMarkReviewed}
                  disabled={reviewPending}
                  className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {reviewPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                  Mark Review Complete
                </button>
              </div>
            )}
          </div>

          {/* Related controls */}
          <div>
            <label className="mb-2 block text-xs font-semibold text-gray-700 dark:text-gray-300">
              Controls Mandated by This Policy <span className="font-normal text-gray-400">({related.length} linked)</span>
            </label>
            <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-lg border dark:border-gray-700 p-2">
              {controls.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-start gap-2 rounded px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300 text-blue-600"
                    checked={related.includes(c.controlCode)}
                    onChange={() => toggleControl(c.controlCode)}
                  />
                  <span className="min-w-0">
                    <span className="font-mono text-[11px] font-bold text-gray-700 dark:text-gray-300">{c.controlCode}</span>
                    <span className="ml-1.5 text-[11px] text-gray-500 dark:text-gray-400">{c.title}</span>
                  </span>
                </label>
              ))}
              {controls.length === 0 && <p className="px-2 py-3 text-center text-[11px] text-gray-400">No controls available.</p>}
            </div>
          </div>

          {/* Revision note */}
          {isEdit && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                Change Summary <span className="font-normal text-gray-400">logged in version history when you save</span>
              </label>
              <input className={inputCls} value={revisionSummary} onChange={(e) => setRevisionSummary(e.target.value)} placeholder="e.g. v2.1 — added remote work section; annual review" />
            </div>
          )}

          {error && <p className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex gap-3 border-t dark:border-gray-800 pt-4">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">Cancel</button>
            <button type="submit" disabled={isPending} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Create Policy"}
            </button>
          </div>

          {/* Version history */}
          {isEdit && policy!.revisions.length > 0 && (
            <div className="border-t dark:border-gray-800 pt-4">
              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
                <History className="h-3.5 w-3.5 text-gray-400" /> Version History
              </p>
              <div className="space-y-2.5">
                {policy!.revisions.map((rev) => (
                  <div key={rev.id} className="flex gap-3">
                    <span className="mt-0.5 h-fit flex-shrink-0 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-1.5 py-0.5 font-mono text-[10px] font-bold text-gray-600 dark:text-gray-400">
                      v{rev.version}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-700 dark:text-gray-300">{rev.summary}</p>
                      <p className="text-[10px] text-gray-400">{rev.changedBy} · {timeAgo(rev.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [controls, setControls] = useState<ControlOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showDrawer, setShowDrawer] = useState(false);
  const [editPolicy, setEditPolicy] = useState<Policy | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [overdueFilter, setOverdueFilter] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/policies").then((r) => r.json()),
      fetch("/api/controls?pageSize=200").then((r) => r.json()),
    ]).then(([polData, ctrlData]) => {
      if (polData?.error) setLoadError(polData.error);
      setPolicies(polData.data ?? []);
      setControls(ctrlData.data ?? []);
    }).catch((e) => setLoadError(e.message)).finally(() => setLoading(false));
  }, []);

  function handleSaved(saved: Policy) {
    setPolicies((prev) => {
      const exists = prev.find((p) => p.id === saved.id);
      return exists ? prev.map((p) => (p.id === saved.id ? saved : p)) : [...prev, saved].sort((a, b) => a.policyCode.localeCompare(b.policyCode));
    });
  }

  const categories = useMemo(() => Array.from(new Set(policies.map((p) => p.category).filter(Boolean))).sort() as string[], [policies]);
  const owners = useMemo(() => Array.from(new Set(policies.map((p) => p.owner).filter(Boolean))).sort() as string[], [policies]);

  const overdueCount = policies.filter(isReviewOverdue).length;
  const statusCounts = {
    APPROVED: policies.filter((p) => p.status === "APPROVED").length,
    IN_REVIEW: policies.filter((p) => p.status === "IN_REVIEW").length,
    DRAFT: policies.filter((p) => p.status === "DRAFT").length,
    RETIRED: policies.filter((p) => p.status === "RETIRED").length,
  };

  const hasFilters = Boolean(statusFilter || overdueFilter || searchFilter || categoryFilter || ownerFilter);

  const filtered = policies.filter((p) => {
    if (statusFilter && p.status !== statusFilter) return false;
    if (overdueFilter && !isReviewOverdue(p)) return false;
    if (categoryFilter && p.category !== categoryFilter) return false;
    if (ownerFilter && p.owner !== ownerFilter) return false;
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      if (
        !p.policyCode.toLowerCase().includes(q) &&
        !p.name.toLowerCase().includes(q) &&
        !(p.description ?? "").toLowerCase().includes(q) &&
        !p.relatedControls.some((c) => c.toLowerCase().includes(q))
      ) return false;
    }
    return true;
  });

  function clearFilters() {
    setStatusFilter(""); setOverdueFilter(false); setSearchFilter(""); setCategoryFilter(""); setOwnerFilter("");
  }

  return (
    <>
      <Header title="Policy Register" subtitle="Document, version, and review cybersecurity & IT policies" />
      <main className="grc-page space-y-6">
        {loadError && (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-5 py-4 text-sm text-red-700 dark:text-red-400">
            <strong>Couldn&apos;t load policies:</strong> {loadError}
            {loadError.toLowerCase().includes("does not exist") && (
              <span className="block mt-1 text-xs">Run <code className="rounded bg-red-100 dark:bg-red-900 px-1">npm run db:push</code> to add the new Policy tables, then restart.</span>
            )}
            <button onClick={() => window.location.reload()} className="ml-3 rounded-lg border border-red-300 dark:border-red-700 px-2.5 py-1 text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900">Retry</button>
          </div>
        )}

        {/* Stat cards — clickable filters */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {(["APPROVED", "IN_REVIEW", "DRAFT", "RETIRED"] as const).map((status) => {
            const conf = STATUS_CONFIG[status];
            const Icon = conf.icon;
            const active = statusFilter === status;
            return (
              <button
                key={status}
                onClick={() => setStatusFilter(active ? "" : status)}
                title={active ? "Click to clear filter" : `Filter by ${conf.label}`}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-4 text-left transition-all cursor-pointer hover:shadow-md",
                  conf.color,
                  active && "ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-gray-950"
                )}
              >
                <Icon className="h-5 w-5" />
                <div>
                  <p className="text-xl font-bold">{statusCounts[status]}</p>
                  <p className="text-xs font-medium">{conf.label}</p>
                </div>
              </button>
            );
          })}
          <button
            onClick={() => setOverdueFilter(!overdueFilter)}
            title={overdueFilter ? "Click to clear filter" : "Filter by overdue reviews"}
            className={cn(
              "flex items-center gap-3 rounded-xl border p-4 text-left transition-all cursor-pointer hover:shadow-md",
              "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800",
              overdueFilter && "ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-gray-950"
            )}
          >
            <CalendarClock className="h-5 w-5" />
            <div>
              <p className="text-xl font-bold">{overdueCount}</p>
              <p className="text-xs font-medium">REVIEW OVERDUE</p>
            </div>
          </button>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <div className="flex items-center justify-between border-b dark:border-gray-800 px-6 py-4">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Policies ({filtered.length}{hasFilters ? ` of ${policies.length}` : ""})
              </h2>
              {hasFilters && (
                <button onClick={clearFilters} className="flex items-center gap-1 rounded-full border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 px-2.5 py-1 text-[11px] font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900">
                  <FilterX className="h-3 w-3" /> Clear filters
                </button>
              )}
            </div>
            <button
              onClick={() => { setEditPolicy(null); setShowDrawer(true); }}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <Plus className="h-3.5 w-3.5" /> Add Policy
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Policy</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Version</th>
                  <th>Owner</th>
                  <th>Controls</th>
                  <th>Effective</th>
                  <th>Next Review</th>
                  <th>Document</th>
                </tr>
                <tr className="bg-gray-50/70 dark:bg-gray-800/40">
                  <th className="py-2 pr-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
                      <input className={cn(filterCls, "pl-6")} placeholder="Search name, code..." value={searchFilter} onChange={(e) => setSearchFilter(e.target.value)} />
                    </div>
                  </th>
                  <th className="py-2 pr-2">
                    <select className={filterCls} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                      <option value="">All categories</option>
                      {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </th>
                  <th className="py-2 pr-2">
                    <select className={filterCls} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                      <option value="">All statuses</option>
                      {Object.entries(STATUS_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
                    </select>
                  </th>
                  <th></th>
                  <th className="py-2 pr-2">
                    <select className={filterCls} value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
                      <option value="">All owners</option>
                      {owners.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </th>
                  <th></th>
                  <th></th>
                  <th></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-300" /></td></tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-sm text-gray-400 dark:text-gray-500">
                      {hasFilters ? "No policies match the current filters." : (
                        <span className="flex flex-col items-center gap-2">
                          <ScrollText className="h-8 w-8 text-gray-200 dark:text-gray-700" />
                          No policies yet. Upload your first policy document to get started.
                        </span>
                      )}
                    </td>
                  </tr>
                ) : filtered.map((p) => {
                  const conf = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.DRAFT;
                  const Icon = conf.icon;
                  const overdue = isReviewOverdue(p);
                  return (
                    <tr key={p.id} onClick={() => { setEditPolicy(p); setShowDrawer(true); }} title="Click to open policy details" className="cursor-pointer">
                      <td>
                        <p className="font-mono text-xs font-bold text-gray-500 dark:text-gray-400">{p.policyCode}</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{p.name}</p>
                      </td>
                      <td className="text-xs text-gray-500 dark:text-gray-400">{p.category ?? "—"}</td>
                      <td>
                        <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap", conf.color)}>
                          <Icon className="h-3 w-3" />{conf.label}
                        </span>
                      </td>
                      <td>
                        <span className="rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-1.5 py-0.5 font-mono text-[11px] font-bold text-gray-600 dark:text-gray-400">
                          v{p.version}
                        </span>
                        {p.revisions.length > 1 && <span className="ml-1.5 text-[10px] text-gray-400">{p.revisions.length} revisions</span>}
                      </td>
                      <td className="text-sm text-gray-600 dark:text-gray-400">{p.owner ?? "—"}</td>
                      <td>
                        {p.relatedControls.length > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:text-blue-400">
                            <ShieldCheck className="h-3 w-3" />{p.relatedControls.length}
                          </span>
                        ) : <span className="text-xs text-gray-300 dark:text-gray-600">—</span>}
                      </td>
                      <td className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{p.effectiveDate ? formatDate(p.effectiveDate) : "—"}</td>
                      <td>
                        {p.nextReviewDate ? (
                          <span className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap",
                            overdue
                              ? "bg-red-50 border-red-200 text-red-600 dark:bg-red-950 dark:border-red-800 dark:text-red-400"
                              : "bg-gray-50 border-gray-200 text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400"
                          )}>
                            {overdue && <CalendarClock className="h-2.5 w-2.5" />}
                            {formatDate(p.nextReviewDate)}{overdue && " · OVERDUE"}
                          </span>
                        ) : <span className="text-xs text-gray-300 dark:text-gray-600">—</span>}
                      </td>
                      <td>
                        {p.fileName ? (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400" title={p.fileName}>
                            <FileText className="h-3.5 w-3.5 text-gray-400" />
                            <span className="max-w-[120px] truncate">{p.fileName}</span>
                          </span>
                        ) : <span className="text-xs text-gray-300 dark:text-gray-600">No file</span>}
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
        <PolicyDrawer
          policy={editPolicy ?? undefined}
          controls={controls}
          onClose={() => { setShowDrawer(false); setEditPolicy(null); }}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
