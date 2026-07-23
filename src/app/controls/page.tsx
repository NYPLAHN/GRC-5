"use client";

import { useState, useEffect, useTransition } from "react";
import Header from "@/components/layout/Header";
import {
  ShieldCheck, CheckCircle2, Clock, XCircle, Minus,
  Tag, X, Loader2, Pencil, Plus, Search,
} from "lucide-react";
import { cn, formatControlStatus, getControlStatusClasses } from "@/lib/utils";
import ImportControlsButton from "@/components/controls/ImportControlsButton";

type NistRequirement = {
  id: string;
  controlId: string;
  category: string;
  subCategory: string | null;
  title: string;
};

type FrameworkMapping = {
  requirementId: string;
  requirement: {
    id: string;
    controlId: string;
    framework: { slug: string; name: string };
  };
};

type Control = {
  id: string;
  controlCode: string;
  title: string;
  description: string;
  status: string;
  owner: string | null;
  category: string | null;
  tags: string[];
  frameworkMappings: FrameworkMapping[];
  _count: { evidence: number; remediations: number };
};

const STATUS_ICONS = {
  IMPLEMENTED: CheckCircle2,
  IN_PROGRESS: Clock,
  NOT_STARTED: XCircle,
  NOT_APPLICABLE: Minus,
};

// Only show NIST CSF — CIS is seeded but not NYPL's active framework
const FRAMEWORK_COLORS: Record<string, string> = {
  NIST_CSF_2: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
};
const FRAMEWORK_SHORT: Record<string, string> = {
  NIST_CSF_2: "NIST CSF",
};

// NIST CSF function colors for the mapping selector
const FUNCTION_COLORS: Record<string, string> = {
  GOVERN: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
  IDENTIFY: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  PROTECT: "bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
  DETECT: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800",
  RESPOND: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800",
  RECOVER: "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800",
};

const STATUS_OPTS = ["IMPLEMENTED", "IN_PROGRESS", "NOT_STARTED", "NOT_APPLICABLE"] as const;

// ─── Edit Drawer ──────────────────────────────────────────────────────────────

function EditDrawer({ control, onClose, onSaved }: {
  control: Control;
  onClose: () => void;
  onSaved: (updated: Control) => void;
}) {
  const [form, setForm] = useState({
    title: control.title,
    description: control.description ?? "",
    status: control.status,
    owner: control.owner ?? "",
    category: control.category ?? "",
    tags: control.tags.join("; "),
  });

  // Framework mapping state
  // Initialize with current NIST mapping UUIDs
  const initialReqIds = control.frameworkMappings
    .filter((m) => m.requirement.framework.slug === "NIST_CSF_2")
    .map((m) => m.requirement.id ?? m.requirementId);

  const [selectedReqIds, setSelectedReqIds] = useState<string[]>(initialReqIds);
  const [nistReqs, setNistReqs] = useState<NistRequirement[]>([]);
  const [loadingReqs, setLoadingReqs] = useState(true);
  const [reqSearch, setReqSearch] = useState("");
  const [showReqPicker, setShowReqPicker] = useState(false);

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/frameworks/requirements?slug=NIST_CSF_2")
      .then((r) => r.json())
      .then((d) => setNistReqs(d.data ?? []))
      .finally(() => setLoadingReqs(false));
  }, []);

  const selectedReqs = nistReqs.filter((r) => selectedReqIds.includes(r.id));
  const filteredReqs = nistReqs.filter((r) => {
    if (selectedReqIds.includes(r.id)) return false; // already selected
    if (!reqSearch) return true;
    const q = reqSearch.toLowerCase();
    return (
      r.controlId.toLowerCase().includes(q) ||
      r.title.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q)
    );
  });

  // Group by NIST function
  const groupedFiltered = filteredReqs.reduce<Record<string, NistRequirement[]>>((acc, req) => {
    const fn = req.category.toUpperCase();
    if (!acc[fn]) acc[fn] = [];
    acc[fn].push(req);
    return acc;
  }, {});

  function toggleReq(reqId: string) {
    setSelectedReqIds((prev) =>
      prev.includes(reqId) ? prev.filter((id) => id !== reqId) : [...prev, reqId]
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        const res = await fetch(`/api/controls/${control.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: form.title,
            description: form.description,
            status: form.status,
            owner: form.owner || null,
            category: form.category || null,
            tags: form.tags
              ? form.tags.split(";").map((t) => t.trim()).filter(Boolean)
              : [],
            frameworkRequirementIds: selectedReqIds,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Update failed");
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
            <p className="text-xs font-mono font-bold text-gray-400 dark:text-gray-500">{control.controlCode}</p>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Edit Control</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="h-5 w-5 dark:text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Title *</label>
            <input
              required
              className="w-full rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Description</label>
            <textarea
              rows={4}
              className="w-full rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Implementation Status *</label>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTS.map((s) => {
                const Icon = STATUS_ICONS[s];
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, status: s }))}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium transition-colors text-left",
                      form.status === s
                        ? getControlStatusClasses(s)
                        : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                    {formatControlStatus(s)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Owner</label>
              <input
                className="w-full rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.owner}
                onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}
                placeholder="Team or person responsible"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Category</label>
              <input
                className="w-full rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="e.g. Identity & Access"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
              Tags <span className="font-normal text-gray-400">— separate with semicolons</span>
            </label>
            <input
              className="w-full rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.tags}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              placeholder="mfa; authentication; identity"
            />
          </div>

          {/* ── NIST CSF Framework Mappings ── */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                NIST CSF 2.0 Mappings
              </label>
              <button
                type="button"
                onClick={() => setShowReqPicker((v) => !v)}
                className="flex items-center gap-1 rounded-lg border border-blue-300 dark:border-blue-700 px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40"
              >
                <Plus className="h-3 w-3" /> Add mapping
              </button>
            </div>

            {/* Currently mapped chips */}
            {selectedReqs.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedReqs.map((req) => (
                  <span
                    key={req.id}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                      FUNCTION_COLORS[req.category.toUpperCase()] ?? "bg-gray-100 text-gray-600 border-gray-200"
                    )}
                  >
                    {req.controlId}
                    <button
                      type="button"
                      onClick={() => toggleReq(req.id)}
                      className="ml-0.5 rounded-full hover:opacity-70"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="mb-2 text-xs text-gray-400 dark:text-gray-500">
                No NIST CSF mappings yet. Click "Add mapping" to link this control to a NIST requirement.
              </p>
            )}

            {/* Requirement picker dropdown */}
            {showReqPicker && (
              <div className="rounded-xl border dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-3 space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input
                    autoFocus
                    placeholder="Search by control ID or keyword…"
                    className="w-full rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 pl-8 pr-3 py-1.5 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={reqSearch}
                    onChange={(e) => setReqSearch(e.target.value)}
                  />
                </div>

                {loadingReqs ? (
                  <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading requirements…
                  </div>
                ) : (
                  <div className="max-h-56 overflow-y-auto space-y-2">
                    {Object.entries(groupedFiltered).length === 0 && (
                      <p className="text-xs text-gray-400 py-2 text-center">
                        {reqSearch ? "No matches found." : "All requirements already mapped!"}
                      </p>
                    )}
                    {Object.entries(groupedFiltered).map(([fn, reqs]) => (
                      <div key={fn}>
                        <p className={cn(
                          "mb-1 rounded px-2 py-0.5 text-[10px] font-bold w-fit",
                          FUNCTION_COLORS[fn] ?? "bg-gray-200 text-gray-600"
                        )}>{fn}</p>
                        <div className="space-y-0.5">
                          {reqs.map((req) => (
                            <button
                              key={req.id}
                              type="button"
                              onClick={() => { toggleReq(req.id); setReqSearch(""); }}
                              className="w-full text-left rounded-lg px-2 py-1.5 text-xs hover:bg-white dark:hover:bg-gray-700 transition-colors"
                            >
                              <span className="font-mono font-semibold text-gray-700 dark:text-gray-300">{req.controlId}</span>
                              <span className="ml-2 text-gray-500 dark:text-gray-400 truncate">{req.title}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="flex gap-3 border-t dark:border-gray-800 pt-4">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Controls Page ─────────────────────────────────────────────────────────────

export default function ControlsPage() {
  const [controls, setControls] = useState<Control[]>([]);
  const [loading, setLoading] = useState(true);
  const [editControl, setEditControl] = useState<Control | null>(null);

  useEffect(() => {
    fetch("/api/controls?pageSize=200")
      .then((r) => r.json())
      .then((d) => setControls(d.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  function handleSaved(updated: Control) {
    setControls((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  const statusCounts = {
    IMPLEMENTED: controls.filter((c) => c.status === "IMPLEMENTED").length,
    IN_PROGRESS: controls.filter((c) => c.status === "IN_PROGRESS").length,
    NOT_STARTED: controls.filter((c) => c.status === "NOT_STARTED").length,
    NOT_APPLICABLE: controls.filter((c) => c.status === "NOT_APPLICABLE").length,
  };

  const nistMapped = controls.filter((c) =>
    c.frameworkMappings.some((m) => m.requirement.framework.slug === "NIST_CSF_2")
  ).length;

  return (
    <>
      <Header title="Controls Library" subtitle="Map once, comply to many frameworks" />
      <main className="grc-page space-y-6">
        {/* Status summary */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(["IMPLEMENTED", "IN_PROGRESS", "NOT_STARTED", "NOT_APPLICABLE"] as const).map((status) => {
            const Icon = STATUS_ICONS[status];
            return (
              <div key={status} className={cn("flex items-center gap-3 rounded-xl border p-4", getControlStatusClasses(status))}>
                <Icon className="h-5 w-5" />
                <div>
                  <p className="text-xl font-bold">{statusCounts[status]}</p>
                  <p className="text-xs">{formatControlStatus(status)}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* NIST CSF coverage banner */}
        {controls.length > 0 && (
          <div className="rounded-xl border bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 dark:border-blue-900/50 p-4">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              <ShieldCheck className="mr-1.5 inline-block h-4 w-4 text-blue-600 dark:text-blue-400" />
              <strong>{nistMapped}</strong> of <strong>{controls.length}</strong> controls mapped to{" "}
              <strong>NIST CSF 2.0</strong>.{" "}
              {nistMapped < controls.length && (
                <span className="text-amber-600 dark:text-amber-400">
                  {controls.length - nistMapped} unmapped — click Edit on any control to add a mapping.
                </span>
              )}
            </p>
          </div>
        )}

        {/* Controls Table */}
        <div className="overflow-hidden rounded-xl border dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <div className="flex items-center justify-between border-b dark:border-gray-800 px-6 py-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Internal Controls ({controls.length})
            </h2>
            <ImportControlsButton onImported={() => {
              setLoading(true);
              fetch("/api/controls?pageSize=200").then((r) => r.json()).then((d) => setControls(d.data ?? [])).finally(() => setLoading(false));
            }} />
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-300" /></div>
            ) : (
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th>Control</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>NIST CSF Mappings</th>
                    <th>Owner</th>
                    <th>Evidence</th>
                    <th className="w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {controls.map((control) => {
                    const Icon = STATUS_ICONS[control.status as keyof typeof STATUS_ICONS] ?? Minus;

                    // Only show NIST CSF mappings
                    const nistMappings = control.frameworkMappings.filter(
                      (m) => m.requirement.framework.slug === "NIST_CSF_2"
                    );

                    return (
                      <tr key={control.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-gray-100 text-xs">{control.controlCode}</p>
                            <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 font-medium">{control.title}</p>
                            {control.tags.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {control.tags.slice(0, 3).map((tag) => (
                                  <span key={tag} className="inline-flex items-center gap-0.5 rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                                    <Tag className="h-2.5 w-2.5" />{tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="text-gray-500 dark:text-gray-400 text-xs">{control.category ?? "—"}</td>
                        <td>
                          <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", getControlStatusClasses(control.status))}>
                            <Icon className="h-3 w-3" />
                            {formatControlStatus(control.status)}
                          </span>
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-1.5">
                            {nistMappings.length > 0 ? (
                              nistMappings.slice(0, 4).map((m) => (
                                <span
                                  key={m.requirementId}
                                  className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
                                >
                                  {m.requirement.controlId}
                                </span>
                              ))
                            ) : (
                              <button
                                onClick={() => setEditControl(control)}
                                className="text-xs text-amber-600 dark:text-amber-400 hover:underline"
                              >
                                + Add mapping
                              </button>
                            )}
                            {nistMappings.length > 4 && (
                              <span className="text-xs text-gray-400">+{nistMappings.length - 4} more</span>
                            )}
                          </div>
                        </td>
                        <td className="text-sm text-gray-600 dark:text-gray-400">{control.owner ?? <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                        <td>
                          <span className="inline-flex items-center gap-1 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-0.5 text-xs text-gray-500 dark:text-gray-400">
                            {control._count.evidence} artifact{control._count.evidence !== 1 ? "s" : ""}
                          </span>
                        </td>
                        <td>
                          <button
                            onClick={() => setEditControl(control)}
                            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-600 dark:hover:text-blue-400"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {!loading && controls.length === 0 && (
              <div className="py-16 text-center text-sm text-gray-400 dark:text-gray-500">
                No controls found. Import controls using the button above.
              </div>
            )}
          </div>
        </div>
      </main>

      {editControl && (
        <EditDrawer
          control={editControl}
          onClose={() => setEditControl(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
