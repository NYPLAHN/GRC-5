"use client";

import { UserButton } from "@clerk/nextjs";
import {
  Bell, Search, Sun, Moon, X, Loader2, ShieldCheck, AlertTriangle, Wrench,
  FolderLock, CalendarClock, ScrollText,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import GrcAssistant from "@/components/layout/GrcAssistant";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

// ─── Theme toggle ───────────────────────────────────────────────

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="flex h-9 w-9 items-center justify-center rounded-lg" />;
  const isDark = theme === "dark";
  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

// ─── Global search ──────────────────────────────────────────────

type SearchResults = {
  controls: { id: string; controlCode: string; title: string; status: string }[];
  risks: { id: string; riskId: string; title: string; inherentScore: number; isOpen: boolean }[];
  remediations: { id: string; title: string; status: string }[];
  evidence: { id: string; title: string; fileName: string; fileType: string }[];
  policies?: { id: string; policyCode: string; name: string; status: string }[];
};

const EMPTY_RESULTS: SearchResults = { controls: [], risks: [], remediations: [], evidence: [], policies: [] };

function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close on outside click / Escape
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
      // Cmd/Ctrl+K opens search
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // Debounced fetch
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(EMPTY_RESULTS);
      setError("");
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query.trim())}`)
        .then(async (r) => {
          const d = await r.json();
          if (!r.ok) throw new Error(d.error ?? `Search failed (${r.status})`);
          setResults(d.data ?? EMPTY_RESULTS);
          setError("");
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  const total = results.controls.length + results.risks.length + results.remediations.length + results.evidence.length + (results.policies?.length ?? 0);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => { setOpen((o) => !o); setTimeout(() => inputRef.current?.focus(), 50); }}
        title="Search (⌘K)"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
      >
        <Search className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-96 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl">
          <div className="flex items-center gap-2 border-b dark:border-gray-800 px-3 py-2.5">
            <Search className="h-4 w-4 flex-shrink-0 text-gray-400" />
            <input
              ref={inputRef}
              className="w-full border-none bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none"
              placeholder="Search controls, risks, remediations, evidence..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {loading ? (
              <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-gray-400" />
            ) : query ? (
              <button onClick={() => setQuery("")}><X className="h-4 w-4 text-gray-400 hover:text-gray-600" /></button>
            ) : (
              <kbd className="rounded border dark:border-gray-700 px-1.5 py-0.5 text-[10px] text-gray-400">⌘K</kbd>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto p-1.5">
            {error && <p className="px-3 py-3 text-xs text-red-500">{error}</p>}
            {!error && query.trim().length >= 2 && total === 0 && !loading && (
              <p className="px-3 py-4 text-center text-xs text-gray-400">No results for &quot;{query}&quot;</p>
            )}
            {query.trim().length < 2 && (
              <p className="px-3 py-4 text-center text-xs text-gray-400">Type at least 2 characters to search everything.</p>
            )}

            {results.controls.length > 0 && (
              <div className="mb-1">
                <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Controls</p>
                {results.controls.map((c) => (
                  <button key={c.id} onClick={() => go("/controls")} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800">
                    <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
                    <span className="font-mono text-[11px] font-bold text-gray-500">{c.controlCode}</span>
                    <span className="truncate text-xs text-gray-700 dark:text-gray-300">{c.title}</span>
                  </button>
                ))}
              </div>
            )}
            {(results.policies?.length ?? 0) > 0 && (
              <div className="mb-1">
                <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Policies</p>
                {results.policies!.map((p) => (
                  <button key={p.id} onClick={() => go("/policies")} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800">
                    <ScrollText className="h-3.5 w-3.5 flex-shrink-0 text-indigo-500" />
                    <span className="font-mono text-[11px] font-bold text-gray-500">{p.policyCode}</span>
                    <span className="truncate text-xs text-gray-700 dark:text-gray-300">{p.name}</span>
                  </button>
                ))}
              </div>
            )}
            {results.risks.length > 0 && (
              <div className="mb-1">
                <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Risks</p>
                {results.risks.map((r) => (
                  <button key={r.id} onClick={() => go("/risks")} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800">
                    <AlertTriangle className={cn("h-3.5 w-3.5 flex-shrink-0", r.inherentScore >= 15 ? "text-red-500" : "text-orange-400")} />
                    <span className="font-mono text-[11px] font-bold text-gray-500">{r.riskId}</span>
                    <span className="truncate text-xs text-gray-700 dark:text-gray-300">{r.title}</span>
                  </button>
                ))}
              </div>
            )}
            {results.remediations.length > 0 && (
              <div className="mb-1">
                <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Remediations</p>
                {results.remediations.map((r) => (
                  <button key={r.id} onClick={() => go("/remediation")} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800">
                    <Wrench className="h-3.5 w-3.5 flex-shrink-0 text-purple-500" />
                    <span className="truncate text-xs text-gray-700 dark:text-gray-300">{r.title}</span>
                  </button>
                ))}
              </div>
            )}
            {results.evidence.length > 0 && (
              <div className="mb-1">
                <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Evidence</p>
                {results.evidence.map((e) => (
                  <button key={e.id} onClick={() => go("/evidence")} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800">
                    <FolderLock className="h-3.5 w-3.5 flex-shrink-0 text-green-500" />
                    <span className="truncate text-xs text-gray-700 dark:text-gray-300">{e.title}</span>
                    <span className="ml-auto text-[10px] text-gray-400">{e.fileType}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Alerts bell ────────────────────────────────────────────────

type AlertItem = {
  id: string;
  type: string;
  title: string;
  detail: string;
  href: string;
};

const ALERT_ICONS: Record<string, { Icon: React.ElementType; color: string }> = {
  OVERDUE_REMEDIATION: { Icon: Wrench, color: "text-red-500" },
  POLICY_REVIEW: { Icon: ScrollText, color: "text-indigo-500" },
  EXCEPTION_REVIEW: { Icon: CalendarClock, color: "text-amber-500" },
  EXPIRED_EVIDENCE: { Icon: FolderLock, color: "text-red-500" },
  EXPIRING_EVIDENCE: { Icon: FolderLock, color: "text-yellow-500" },
  CRITICAL_RISK: { Icon: AlertTriangle, color: "text-red-500" },
};

function AlertsBell() {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/alerts")
      .then((r) => r.json())
      .then((d) => setAlerts(d.data ?? []))
      .catch(() => setAlerts([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title={`${alerts.length} alert${alerts.length !== 1 ? "s" : ""}`}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
      >
        <Bell className="h-4 w-4" />
        {alerts.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-white dark:ring-gray-900">
            {alerts.length > 9 ? "9+" : alerts.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-96 rounded-xl border dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl">
          <div className="border-b dark:border-gray-800 px-4 py-3">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Needs Attention {!loading && <span className="font-normal text-gray-400">({alerts.length})</span>}
            </p>
          </div>
          <div className="max-h-96 overflow-y-auto p-1.5">
            {loading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-gray-300" /></div>
            ) : alerts.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-gray-400">All clear — nothing needs attention. 🎉</p>
            ) : (
              alerts.map((a) => {
                const { Icon, color } = ALERT_ICONS[a.type] ?? { Icon: Bell, color: "text-gray-400" };
                return (
                  <button
                    key={a.id}
                    onClick={() => { setOpen(false); router.push(a.href); }}
                    className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <Icon className={cn("mt-0.5 h-3.5 w-3.5 flex-shrink-0", color)} />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium text-gray-800 dark:text-gray-200">{a.title}</span>
                      <span className="block text-[11px] text-gray-400">{a.detail}</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Header ─────────────────────────────────────────────────────

export default function Header({ title, subtitle }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-white dark:bg-gray-900 dark:border-gray-800 px-6 shadow-sm">
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h1>
        {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        <GrcAssistant />
        <GlobalSearch />
        <AlertsBell />
        <ThemeToggle />
        <UserButton
          afterSignOutUrl="/sign-in"
          appearance={{
            elements: {
              avatarBox: "h-8 w-8",
            },
          }}
        />
      </div>
    </header>
  );
}
