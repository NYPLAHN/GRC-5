"use client";

import { useState, useEffect, useTransition } from "react";
import Header from "@/components/layout/Header";
import { Wrench, Plus, X, Loader2, ExternalLink, CheckCircle2, Clock, AlertCircle, XCircle } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";

type Remediation = {
  id: string; title: string; description: string; status: string; priority: number;
  dueDate: string | null; resolvedAt: string | null; jiraIssueKey: string | null; jiraIssueUrl: string | null;
  control: { controlCode: string; title: string };
  assignee: { name: string | null; email: string };
};

type Control = { id: string; controlCode: string; title: string };

const STATUS_CONFIG = {
  OPEN: { label: "Open", icon: AlertCircle, color: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800" },
  IN_PROGRESS: { label: "In Progress", icon: Clock, color: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800" },
  RESOLVED: { label: "Resolved", icon: CheckCircle2, color: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-800" },
  WONT_FIX: { label: "Won't Fix", icon: XCircle, color: "bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700" },
};

const PRIORITY_CONFIG: Record<number, { label: string; color: string }> = {
  1: { label: "Critical", color: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800" },
  2: { label: "High", color: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800" },
  3: { label: "Medium", color: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800" },
  4: { label: "Low", color: "bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700" },
};

export default function RemediationPage() {
  const [items, setItems] = useState<Remediation[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDrawer, setShowDrawer] = useState(false);
  const [filter, setFilter] = useState<string>("ALL");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [jiraEnabled, setJiraEnabled] = useState(false);

  const [form, setForm] = useState({
    title: "", description: "", controlId: "", assignedTo: "",
    priority: 2, dueDate: "", createJiraIssue: false,
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/remediation").then((r) => r.json()),
      fetch("/api/controls?pageSize=100").then((r) => r.json()),
    ]).then(([remData, ctrlData]) => {
      setItems(remData.data ?? []);
      setControls(ctrlData.data ?? []);
    }).finally(() => setLoading(false));

    fetch("/api/integrations/jira").then((r) => r.json()).then((d) => setJiraEnabled(d.status === "ok")).catch(() => setJiraEnabled(false));
  }, []);

  const filtered = filter === "ALL" ? items : items.filter((i) => i.status === filter);
  const statusCounts = {
    OPEN: items.filter((i) => i.status === "OPEN").length,
    IN_PROGRESS: items.filter((i) => i.status === "IN_PROGRESS").length,
    RESOLVED: items.filter((i) => i.status === "RESOLVED").length,
  };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        const res = await fetch("/api/remediation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, priority: Number(form.priority) }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed");
        setItems((prev) => [data.data, ...prev]);
        setShowDrawer(false);
        setForm({ title: "", description: "", controlId: "", assignedTo: "", priority: 2, dueDate: "", createJiraIssue: false });
      } catch (err: any) { setError(err.message); }
    });
  }

  return (
    <>
      <Header title="Remediation Tracker" subtitle="Track and resolve compliance gaps — synced with Jira" />
      <main className="grc-page space-y-6">
        {jiraEnabled && (
          <div className="flex items-center gap-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-5 py-3">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-600">
              <span className="text-[10px] font-bold text-white">J</span>
            </div>
            <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Jira integration active — new remediations can be pushed directly to Jira as Tasks.</p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {(["OPEN", "IN_PROGRESS", "RESOLVED"] as const).map((status) => {
            const config = STATUS_CONFIG[status];
            const Icon = config.icon;
            return (
              <button key={status} onClick={() => setFilter(filter === status ? "ALL" : status)}
                className={cn("flex items-center gap-3 rounded-xl border p-4 transition-all text-left", config.color, filter === status && "ring-2 ring-offset-1 ring-blue-500 dark:ring-offset-gray-950")}>
                <Icon className="h-5 w-5" />
                <div>
                  <p className="text-xl font-bold">{statusCounts[status]}</p>
                  <p className="text-xs font-medium">{config.label}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <div className="flex items-center justify-between border-b dark:border-gray-800 px-6 py-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {filter === "ALL" ? `All Remediations (${items.length})` : `${STATUS_CONFIG[filter as keyof typeof STATUS_CONFIG]?.label} (${filtered.length})`}
            </h2>
            <button onClick={() => setShowDrawer(true)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">
              <Plus className="h-3.5 w-3.5" /> New Remediation
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Title</th><th>Control</th><th>Priority</th><th>Status</th><th>Assignee</th><th>Due Date</th><th>Jira</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-300" /></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="py-16 text-center text-sm text-gray-400 dark:text-gray-500">No remediations found.</td></tr>
                ) : (
                  filtered.map((item) => {
                    const statusConf = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG];
                    const StatusIcon = statusConf?.icon ?? Wrench;
                    const priorityConf = PRIORITY_CONFIG[item.priority];
                    const isOverdue = item.dueDate && new Date(item.dueDate) < new Date() && item.status !== "RESOLVED";
                    return (
                      <tr key={item.id}>
                        <td>
                          <p className="font-medium text-gray-900 dark:text-gray-100">{item.title}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 max-w-xs truncate">{item.description}</p>
                        </td>
                        <td>
                          <span className="rounded border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 text-xs font-mono font-bold text-blue-600 dark:text-blue-400">{item.control.controlCode}</span>
                        </td>
                        <td>
                          <span className={cn("rounded-full border px-2 py-0.5 text-xs font-semibold", priorityConf?.color ?? "bg-gray-100 text-gray-600")}>{priorityConf?.label ?? `P${item.priority}`}</span>
                        </td>
                        <td>
                          <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", statusConf?.color)}>
                            <StatusIcon className="h-3 w-3" />{statusConf?.label ?? item.status}
                          </span>
                        </td>
                        <td className="text-sm text-gray-600 dark:text-gray-400">{item.assignee.name ?? item.assignee.email}</td>
                        <td>
                          {item.dueDate ? (
                            <span className={cn("text-sm", isOverdue ? "font-semibold text-red-600 dark:text-red-400" : "text-gray-600 dark:text-gray-400")}>
                              {formatDate(item.dueDate)}{isOverdue && " ⚠"}
                            </span>
                          ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                        </td>
                        <td>
                          {item.jiraIssueKey ? (
                            <a href={item.jiraIssueUrl ?? "#"} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900">
                              {item.jiraIssueKey}<ExternalLink className="h-3 w-3" />
                            </a>
                          ) : <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {showDrawer && (
        <div className="fixed inset-0 z-50 flex items-start justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowDrawer(false)} />
          <div className="relative z-10 h-full w-full max-w-lg overflow-y-auto bg-white dark:bg-gray-900 shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">New Remediation</h2>
              <button onClick={() => setShowDrawer(false)} className="rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-800"><X className="h-5 w-5 dark:text-gray-400" /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Title *</label>
                <input required className="w-full rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Deploy MFA to all admin accounts" />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Description *</label>
                <textarea required rows={3} className="w-full rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Detailed remediation steps, acceptance criteria..." />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Linked Control *</label>
                <select required className="w-full rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.controlId} onChange={(e) => setForm((f) => ({ ...f, controlId: e.target.value }))}>
                  <option value="">Select a control...</option>
                  {controls.map((c) => <option key={c.id} value={c.id}>{c.controlCode} – {c.title}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Priority</label>
                  <select className="w-full rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))}>
                    <option value={1}>1 – Critical</option>
                    <option value={2}>2 – High</option>
                    <option value={3}>3 – Medium</option>
                    <option value={4}>4 – Low</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Due Date</label>
                  <input type="date" className="w-full rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Assign To (User ID) *</label>
                <input required className="w-full rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.assignedTo} onChange={(e) => setForm((f) => ({ ...f, assignedTo: e.target.value }))} placeholder="Paste a User ID from Admin → Users" />
              </div>

              {jiraEnabled && (
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border dark:border-gray-700 p-4 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600" checked={form.createJiraIssue} onChange={(e) => setForm((f) => ({ ...f, createJiraIssue: e.target.checked }))} />
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Create Jira Issue</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Automatically POST a Task to Jira and link it here.</p>
                  </div>
                </label>
              )}

              {error && <p className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

              <div className="flex gap-3 border-t dark:border-gray-800 pt-4">
                <button type="button" onClick={() => setShowDrawer(false)} className="flex-1 rounded-lg border dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">Cancel</button>
                <button type="submit" disabled={isPending} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                  {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {form.createJiraIssue ? "Create & Push to Jira" : "Create Remediation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
