"use client";

import { useState, useEffect, useTransition } from "react";
import Header from "@/components/layout/Header";
import { FolderLock, Upload, FileText, Image, FileCode, File, X, Plus, Search, Tag, Loader2, Calendar, Clock } from "lucide-react";
import { cn, formatDate, formatFileSize, timeAgo } from "@/lib/utils";

type EvidenceItem = {
  id: string; title: string; description: string | null;
  fileName: string; fileSize: number; fileType: string; storageKey: string;
  version: number; tags: string[]; collectedAt: string; expiresAt: string | null;
  control: { controlCode: string; title: string } | null;
  uploader: { name: string | null; email: string };
};

type Control = { id: string; controlCode: string; title: string };

const FILE_ICONS: Record<string, React.ElementType> = {
  PDF: FileText, IMAGE: Image, CSV: FileCode, JSON: FileCode, OTHER: File,
};

const FILE_TYPE_COLORS: Record<string, string> = {
  PDF: "bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800",
  IMAGE: "bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950 dark:text-purple-400 dark:border-purple-800",
  CSV: "bg-green-50 text-green-600 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800",
  JSON: "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800",
  OTHER: "bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
};

function isExpiringSoon(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const daysUntil = (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return daysUntil <= 30 && daysUntil >= 0;
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

export default function EvidencePage() {
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    title: "", description: "", fileName: "", fileSize: 0,
    fileType: "PDF" as const, storageKey: "", controlId: "", tags: "", expiresAt: "",
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/evidence").then((r) => r.json()),
      fetch("/api/controls?pageSize=100").then((r) => r.json()),
    ]).then(([evData, ctrlData]) => {
      setEvidence(evData.data ?? []);
      setControls(ctrlData.data ?? []);
    }).finally(() => setLoading(false));
  }, []);

  const filtered = evidence.filter(
    (e) => e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.fileName.toLowerCase().includes(search.toLowerCase()) ||
      e.control?.controlCode.toLowerCase().includes(search.toLowerCase()) ||
      e.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toUpperCase() ?? "OTHER";
    const type = ["PDF", "CSV", "JSON"].includes(ext) ? (ext as any) : file.type.startsWith("image/") ? "IMAGE" : "OTHER";
    setForm((f) => ({ ...f, fileName: file.name, fileSize: file.size, fileType: type, storageKey: `evidence/${Date.now()}-${file.name}` }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        const payload = {
          ...form, fileSize: Number(form.fileSize),
          tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
          controlId: form.controlId || undefined,
          expiresAt: form.expiresAt || undefined,
        };
        const res = await fetch("/api/evidence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed");
        setEvidence((prev) => [data.data, ...prev]);
        setShowModal(false);
        setForm({ title: "", description: "", fileName: "", fileSize: 0, fileType: "PDF", storageKey: "", controlId: "", tags: "", expiresAt: "" });
      } catch (err: any) { setError(err.message); }
    });
  }

  const expiringCount = evidence.filter((e) => isExpiringSoon(e.expiresAt)).length;
  const expiredCount = evidence.filter((e) => isExpired(e.expiresAt)).length;

  return (
    <>
      <Header title="Evidence Locker" subtitle="Store and tag compliance artifacts by control" />
      <main className="grc-page space-y-6">
        {(expiringCount > 0 || expiredCount > 0) && (
          <div className="flex flex-wrap gap-3">
            {expiredCount > 0 && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm font-medium text-red-700 dark:text-red-400">
                <Calendar className="h-4 w-4" />{expiredCount} piece{expiredCount > 1 ? "s" : ""} of evidence expired
              </div>
            )}
            {expiringCount > 0 && (
              <div className="flex items-center gap-2 rounded-xl border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/40 px-4 py-3 text-sm font-medium text-yellow-700 dark:text-yellow-400">
                <Clock className="h-4 w-4" />{expiringCount} piece{expiringCount > 1 ? "s" : ""} expiring within 30 days
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" placeholder="Search by title, filename, control, or tag..." className="w-full rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">
            <Plus className="h-3.5 w-3.5" /> Add Evidence
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(["PDF", "IMAGE", "CSV", "JSON"] as const).map((type) => {
            const count = evidence.filter((e) => e.fileType === type).length;
            const Icon = FILE_ICONS[type];
            return (
              <div key={type} className={cn("flex items-center gap-3 rounded-xl border p-4", FILE_TYPE_COLORS[type])}>
                <Icon className="h-5 w-5" />
                <div><p className="text-xl font-bold">{count}</p><p className="text-xs">{type} files</p></div>
              </div>
            );
          })}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-300" /></div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border dark:border-gray-800 bg-white dark:bg-gray-900 py-16 text-center text-sm text-gray-400 dark:text-gray-500">
            <FolderLock className="mx-auto mb-3 h-8 w-8 text-gray-200 dark:text-gray-700" />
            {search ? "No evidence matching your search." : "Evidence locker is empty. Add your first artifact."}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((item) => {
              const Icon = FILE_ICONS[item.fileType] ?? File;
              const expired = isExpired(item.expiresAt);
              const expiring = isExpiringSoon(item.expiresAt);
              return (
                <div key={item.id} className={cn(
                  "flex flex-col gap-3 rounded-xl border bg-white dark:bg-gray-900 p-4 shadow-sm transition-shadow hover:shadow-md",
                  expired ? "border-red-200 dark:border-red-900 bg-red-50/30 dark:bg-red-950/20"
                    : expiring ? "border-yellow-200 dark:border-yellow-900 bg-yellow-50/30 dark:bg-yellow-950/20"
                    : "dark:border-gray-800"
                )}>
                  <div className="flex items-start gap-3">
                    <div className={cn("flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border", FILE_TYPE_COLORS[item.fileType])}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{item.title}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{item.fileName}</p>
                    </div>
                    {item.version > 1 && (
                      <span className="flex-shrink-0 rounded border bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 px-1.5 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400">v{item.version}</span>
                    )}
                  </div>

                  {item.control && (
                    <div className="flex items-center gap-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1.5">
                      <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">{item.control.controlCode}</span>
                      <span className="text-xs text-blue-500 dark:text-blue-400 truncate">{item.control.title}</span>
                    </div>
                  )}

                  {item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.tags.map((tag) => (
                        <span key={tag} className="inline-flex items-center gap-0.5 rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                          <Tag className="h-2.5 w-2.5" />{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-auto flex items-center justify-between border-t dark:border-gray-800 pt-2 text-[10px] text-gray-400 dark:text-gray-500">
                    <span>{formatFileSize(item.fileSize)}</span>
                    <span>{timeAgo(item.collectedAt)}</span>
                    {item.expiresAt && (
                      <span className={cn(expired ? "text-red-500 font-medium" : expiring ? "text-yellow-600 dark:text-yellow-400 font-medium" : "")}>
                        {expired ? "Expired" : `Expires ${formatDate(item.expiresAt)}`}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b dark:border-gray-800 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Add Evidence</h2>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-800"><X className="h-5 w-5 dark:text-gray-400" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-6 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors">
                <Upload className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400">{form.fileName || "Click to select a file"}</span>
                {form.fileSize > 0 && <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">{formatFileSize(form.fileSize)} · {form.fileType}</span>}
                <input type="file" className="hidden" onChange={handleFileSelect} />
              </label>

              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Title *</label>
                <input required className="w-full rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. MFA Enrollment Screenshot – Q2 2026" />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Linked Control</label>
                <select className="w-full rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.controlId} onChange={(e) => setForm((f) => ({ ...f, controlId: e.target.value }))}>
                  <option value="">No control linked</option>
                  {controls.map((c) => <option key={c.id} value={c.id}>{c.controlCode} – {c.title}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Tags</label>
                  <input className="w-full rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder="mfa, q2-2026, audit" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Expires</label>
                  <input type="date" className="w-full rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.expiresAt} onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))} />
                </div>
              </div>

              {error && <p className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

              <div className="flex gap-3 border-t dark:border-gray-800 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 rounded-lg border dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">Cancel</button>
                <button type="submit" disabled={isPending || !form.fileName} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                  {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Evidence
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
