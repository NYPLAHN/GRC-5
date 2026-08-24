"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import Link from "next/link";
import Header from "@/components/layout/Header";
import {
  ChevronLeft, ChevronRight, X, Loader2, Wrench, AlertTriangle,
  CheckCircle2, CalendarDays, ArrowLeft, ExternalLink, Clock,
} from "lucide-react";
import { cn, formatDate, getRiskRating, getRiskBadgeClasses, formatEnumLabel } from "@/lib/utils";

type TimelineItem = {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: number;
  complexity: string | null;
  dueDate: string | null;
  resolvedAt: string | null;
  jiraIssueKey: string | null;
  jiraIssueUrl: string | null;
  control: { controlCode: string; title: string } | null;
  risk: { riskId: string; title: string; inherentScore: number } | null;
  assignee: { id: string; name: string | null; email: string };
};

const PRIORITY_LABELS: Record<number, string> = { 1: "Critical", 2: "High", 3: "Medium", 4: "Low" };

// Visual status of a calendar entry
type VisualStatus = "OVERDUE" | "IN_PROGRESS" | "COMPLETED" | "SCHEDULED";

function visualStatus(item: TimelineItem): VisualStatus {
  if (item.status === "RESOLVED" || item.status === "WONT_FIX") return "COMPLETED";
  if (item.dueDate && new Date(item.dueDate) < new Date(new Date().toDateString())) return "OVERDUE";
  if (item.status === "IN_PROGRESS") return "IN_PROGRESS";
  return "SCHEDULED";
}

const VISUAL_STYLES: Record<VisualStatus, { chip: string; dot: string; label: string }> = {
  OVERDUE:     { chip: "bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800 hover:bg-red-200", dot: "bg-red-500", label: "Overdue" },
  IN_PROGRESS: { chip: "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800 hover:bg-yellow-200", dot: "bg-yellow-500", label: "In Progress" },
  COMPLETED:   { chip: "bg-green-100 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-300 dark:border-green-800 hover:bg-green-200", dot: "bg-green-500", label: "Completed" },
  SCHEDULED:   { chip: "bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 hover:bg-gray-200", dot: "bg-gray-400", label: "Scheduled" },
};

/** Local YYYY-MM-DD key for calendar bucketing */
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function itemDateKey(iso: string): string {
  return dateKey(new Date(iso));
}

// ─── Quick detail modal ─────────────────────────────────────────

function DetailModal({ item, onClose, onUpdated }: {
  item: TimelineItem;
  onClose: () => void;
  onUpdated: (updated: TimelineItem) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const vs = visualStatus(item);
  const styles = VISUAL_STYLES[vs];

  function markComplete() {
    setError("");
    startTransition(async () => {
      try {
        const res = await fetch(`/api/remediation/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "RESOLVED" }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to update");
        onUpdated(data.data);
        onClose();
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-2xl">
        <div className="flex items-start justify-between border-b dark:border-gray-800 px-6 py-4">
          <div className="min-w-0">
            <span className={cn("mb-1.5 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold", styles.chip)}>
              <span className={cn("h-1.5 w-1.5 rounded-full", styles.dot)} />
              {styles.label}
            </span>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 leading-snug">{item.title}</h2>
          </div>
          <button onClick={onClose} className="ml-3 flex-shrink-0 rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="h-5 w-5 dark:text-gray-400" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <p className="text-sm text-gray-600 dark:text-gray-400">{item.description}</p>

          {/* Risk context */}
          {item.risk && (
            <div className="rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50/60 dark:bg-orange-950/30 p-3">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">Risk Context</p>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{item.risk.riskId} · {item.risk.title}</p>
              <span className={cn("mt-1.5 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold", getRiskBadgeClasses(getRiskRating(item.risk.inherentScore)))}>
                {item.risk.inherentScore} · {getRiskRating(item.risk.inherentScore)}
              </span>
            </div>
          )}
          {item.control && (
            <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/30 p-3">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Linked Control</p>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                <span className="font-mono">{item.control.controlCode}</span> · {item.control.title}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Assigned Owner</p>
              <p className="text-gray-800 dark:text-gray-200">{item.assignee.name ?? item.assignee.email}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Target Resolution</p>
              <p className={cn("text-gray-800 dark:text-gray-200", vs === "OVERDUE" && "font-semibold text-red-600 dark:text-red-400")}>
                {item.dueDate ? formatDate(item.dueDate) : "No date set"}{vs === "OVERDUE" && " ⚠"}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Priority</p>
              <p className="text-gray-800 dark:text-gray-200">{PRIORITY_LABELS[item.priority] ?? item.priority}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Complexity</p>
              <p className="text-gray-800 dark:text-gray-200">{item.complexity ? formatEnumLabel(item.complexity) : "—"}</p>
            </div>
          </div>

          {item.jiraIssueKey && (
            <a href={item.jiraIssueUrl ?? "#"} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-100">
              {item.jiraIssueKey} <ExternalLink className="h-3 w-3" />
            </a>
          )}

          {error && <p className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex gap-3 border-t dark:border-gray-800 pt-4">
            <Link href="/remediation" className="flex flex-1 items-center justify-center gap-2 rounded-lg border dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
              <Wrench className="h-4 w-4" /> Open Tracker
            </Link>
            {item.status !== "RESOLVED" && item.status !== "WONT_FIX" && (
              <button
                onClick={markComplete}
                disabled={isPending}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Mark as Complete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────

export default function RemediationTimelinePage() {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selected, setSelected] = useState<TimelineItem | null>(null);

  // Filters
  const [severityFilter, setSeverityFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    fetch("/api/remediation")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? `Failed to load remediations (HTTP ${r.status})`);
        setItems(d.data ?? []);
      })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function handleUpdated(updated: TimelineItem) {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  }

  const owners = useMemo(
    () => Array.from(new Set(items.map((i) => i.assignee.name ?? i.assignee.email))).sort(),
    [items]
  );

  const filtered = items.filter((i) => {
    if (severityFilter) {
      if (severityFilter === "NONE" && i.risk) return false;
      if (severityFilter !== "NONE" && (!i.risk || getRiskRating(i.risk.inherentScore) !== severityFilter)) return false;
    }
    if (ownerFilter && (i.assignee.name ?? i.assignee.email) !== ownerFilter) return false;
    if (statusFilter && visualStatus(i) !== statusFilter) return false;
    return true;
  });

  // ── Trend metrics ──
  const openItems = items.filter((i) => i.status === "OPEN" || i.status === "IN_PROGRESS");
  const overdueCount = items.filter((i) => visualStatus(i) === "OVERDUE").length;
  const resolvedWithDue = items.filter((i) => i.status === "RESOLVED" && i.dueDate && i.resolvedAt);
  const onTime = resolvedWithDue.filter((i) => new Date(i.resolvedAt!) <= new Date(new Date(i.dueDate!).getTime() + 24 * 60 * 60 * 1000 - 1));
  const onTimeRate = resolvedWithDue.length > 0 ? Math.round((onTime.length / resolvedWithDue.length) * 100) : null;

  // ── Calendar construction ──
  const monthLabel = month.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const firstDayOfWeek = month.getDay(); // 0 = Sunday
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const todayKey = dateKey(new Date());

  const itemsByDate = useMemo(() => {
    const map = new Map<string, TimelineItem[]>();
    filtered.forEach((i) => {
      if (!i.dueDate) return;
      const key = itemDateKey(i.dueDate);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(i);
    });
    return map;
  }, [filtered]);

  const undated = filtered.filter((i) => !i.dueDate && (i.status === "OPEN" || i.status === "IN_PROGRESS"));

  const cells: { day: number | null; key: string | null }[] = [
    ...Array.from({ length: firstDayOfWeek }, () => ({ day: null, key: null })),
    ...Array.from({ length: daysInMonth }, (_, idx) => {
      const day = idx + 1;
      return { day, key: dateKey(new Date(month.getFullYear(), month.getMonth(), day)) };
    }),
  ];

  const filterCls =
    "rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500";

  return (
    <>
      <Header title="Remediations Over Time" subtitle="Calendar view of remediation work, due dates, and completion trends" />
      <main className="grc-page space-y-6">
        <Link href="/remediation" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600">
          <ArrowLeft className="h-4 w-4" /> Back to Remediation Tracker
        </Link>

        {loadError && (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-5 py-4 text-sm text-red-700 dark:text-red-400">
            <strong>Couldn&apos;t load remediations:</strong> {loadError}
            <button onClick={() => window.location.reload()} className="ml-3 rounded-lg border border-red-300 dark:border-red-700 px-2.5 py-1 text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900">Retry</button>
          </div>
        )}

        {/* Trend metrics */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-4 rounded-xl border dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950">
              <Wrench className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{openItems.length}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Open Remediations</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-xl border dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-red-50 dark:bg-red-950">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className={cn("text-2xl font-bold", overdueCount > 0 ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-gray-100")}>{overdueCount}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Overdue</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-xl border dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-green-50 dark:bg-green-950">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{onTimeRate !== null ? `${onTimeRate}%` : "—"}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">On-Time Completion Rate{onTimeRate === null ? " (no resolved items with due dates yet)" : ""}</p>
            </div>
          </div>
        </div>

        {/* Calendar card */}
        <div className="overflow-hidden rounded-xl border dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b dark:border-gray-800 px-6 py-4">
            <div className="flex items-center gap-2">
              <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded-lg border dark:border-gray-700 p-1.5 hover:bg-gray-50 dark:hover:bg-gray-800">
                <ChevronLeft className="h-4 w-4 text-gray-500" />
              </button>
              <h2 className="w-44 text-center text-sm font-semibold text-gray-900 dark:text-gray-100">{monthLabel}</h2>
              <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded-lg border dark:border-gray-700 p-1.5 hover:bg-gray-50 dark:hover:bg-gray-800">
                <ChevronRight className="h-4 w-4 text-gray-500" />
              </button>
              <button onClick={() => { const n = new Date(); setMonth(new Date(n.getFullYear(), n.getMonth(), 1)); }} className="ml-1 rounded-lg border dark:border-gray-700 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
                Today
              </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <select className={filterCls} value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
                <option value="">All severities</option>
                <option value="CRITICAL">Critical risk</option>
                <option value="HIGH">High risk</option>
                <option value="MEDIUM">Medium risk</option>
                <option value="LOW">Low risk</option>
                <option value="NONE">No linked risk</option>
              </select>
              <select className={filterCls} value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
                <option value="">All owners</option>
                {owners.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              <select className={filterCls} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All statuses</option>
                <option value="OVERDUE">Overdue</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 border-b dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40 px-6 py-2">
            {(Object.keys(VISUAL_STYLES) as VisualStatus[]).map((vs) => (
              <span key={vs} className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                <span className={cn("h-2 w-2 rounded-full", VISUAL_STYLES[vs].dot)} /> {VISUAL_STYLES[vs].label}
              </span>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-gray-300" /></div>
          ) : (
            <>
              {/* Weekday headers */}
              <div className="grid grid-cols-7 border-b dark:border-gray-800">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-gray-400">{d}</div>
                ))}
              </div>
              {/* Day cells */}
              <div className="grid grid-cols-7">
                {cells.map((cell, idx) => {
                  const dayItems = cell.key ? itemsByDate.get(cell.key) ?? [] : [];
                  const isToday = cell.key === todayKey;
                  return (
                    <div
                      key={idx}
                      className={cn(
                        "min-h-[92px] border-b border-r dark:border-gray-800 p-1.5",
                        idx % 7 === 0 && "border-l-0",
                        !cell.day && "bg-gray-50/50 dark:bg-gray-800/20",
                        isToday && "bg-blue-50/60 dark:bg-blue-950/30"
                      )}
                    >
                      {cell.day && (
                        <>
                          <p className={cn(
                            "mb-1 text-right text-[11px] font-semibold",
                            isToday
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-gray-400 dark:text-gray-500"
                          )}>
                            {isToday ? <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-white">{cell.day}</span> : cell.day}
                          </p>
                          <div className="space-y-1">
                            {dayItems.slice(0, 3).map((item) => {
                              const styles = VISUAL_STYLES[visualStatus(item)];
                              return (
                                <button
                                  key={item.id}
                                  onClick={() => setSelected(item)}
                                  title={`${item.title} — ${styles.label}`}
                                  className={cn("block w-full truncate rounded border px-1.5 py-1 text-left text-[10px] font-medium transition-colors", styles.chip)}
                                >
                                  {item.title}
                                </button>
                              );
                            })}
                            {dayItems.length > 3 && (
                              <button
                                onClick={() => setSelected(dayItems[3])}
                                className="block w-full rounded px-1.5 text-left text-[10px] text-gray-400 hover:text-blue-500"
                              >
                                +{dayItems.length - 3} more
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Undated open items */}
        {!loading && undated.length > 0 && (
          <div className="rounded-xl border dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              <Clock className="h-4 w-4 text-gray-400" /> Open items without a due date ({undated.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {undated.map((item) => {
                const styles = VISUAL_STYLES[visualStatus(item)];
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelected(item)}
                    className={cn("rounded-full border px-3 py-1.5 text-xs font-medium transition-colors", styles.chip)}
                  >
                    {item.title}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-gray-400">Tip: set due dates in the Remediation tracker so these appear on the calendar.</p>
          </div>
        )}

        {!loading && filtered.length === 0 && !loadError && (
          <div className="rounded-xl border dark:border-gray-800 bg-white dark:bg-gray-900 py-14 text-center shadow-sm">
            <CalendarDays className="mx-auto mb-3 h-8 w-8 text-gray-200 dark:text-gray-700" />
            <p className="text-sm text-gray-400 dark:text-gray-500">No remediations match the current filters.</p>
          </div>
        )}
      </main>

      {selected && (
        <DetailModal item={selected} onClose={() => setSelected(null)} onUpdated={handleUpdated} />
      )}
    </>
  );
}
