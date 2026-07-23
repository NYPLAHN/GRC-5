"use client";

import { useState, useEffect, useTransition } from "react";
import Header from "@/components/layout/Header";
import {
  FolderLock, Upload, FileText, Image, FileCode, File, X, Plus, Search, Tag,
  Loader2, Calendar, Clock, Folder, FolderPlus, FolderOpen, Wrench, AlertTriangle, Link2,
} from "lucide-react";
import { cn, formatDate, formatFileSize, timeAgo } from "@/lib/utils";

type EvidenceItem = {
  id: string; title: string; description: string | null;
  fileName: string; fileSize: number; fileType: string; storageKey: string;
  version: number; tags: string[]; collectedAt: string; expiresAt: string | null;
  control: { controlCode: string; title: string } | null;
  risk: { riskId: string; title: string } | null;
  remediation: { id: string; title: string } | null;
  folder: { id: string; name: string } | null;
  uploader: { name: string | null; email: string };
};

type Control = { id: string; controlCode: string; title: string };
type Risk = { id: string; riskId: string; title: string };
type Remediation = { id: string; title: string };
type FolderItem = { id: string; name: string; description: string | null; _count: { evidence: number } };

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

const inputCls =
  "w-full rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

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
  const [risks, setRisks] = useState<Risk[]>([]);
  const [remediations, setRemediations] = useState<Remediation[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [folderFilter, setFolderFilter] = useState<string>(""); // "" all, "UNFILED", or folder id
  const [showModal, setShowModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [folderName, setFolderName] = useState("");
  const [folderDesc, setFolderDesc] = useState("");
  const [folderError, setFolderError] = useState("");

  const [form, setForm] = useState({
    title: "", description: "", fileName: "", fileSize: 0,
    fileType: "PDF" as string, storageKey: "", controlId: "", riskId: "",
    remediationId: "", folderId: "", tags: "", expiresAt: "",
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/evidence").then((r) => r.json()),
      fetch("/api/controls?pageSize=200").then((r) => r.json()),
      fetch("/api/risks").then((r) => r.json()),
      fetch("/api/remediation").then((r) => r.json()),
      fetch("/api/evidence/folders").then((r) => r.json()),
    ]).then(([evData, ctrlData, riskData, remData, folderData]) => {
      setEvidence(evData.data ?? []);
      setControls(ctrlData.data ?? []);
      setRisks(riskData.data ?? []);
      setRemediations(remData.data ?? []);
      setFolders(folderData.data ?? []);
    }).finally(() => setLoading(false));
  }, []);

  const filtered = evidence.filter((e) => {
    if (folderFilter === "UNFILED" && e.folder) return false;
    if (folderFilter && folderFilter !== "UNFILED" && e.folder?.id !== folderFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !e.title.toLowerCase().includes(q) &&
        !e.fileName.toLowerCase().includes(q) &&
        !(e.control?.controlCode.toLowerCase().includes(q)) &&
        !(e.remediation?.title.toLowerCase().includes(q)) &&
        !(e.risk?.riskId.toLowerCase().includes(q)) &&
        !e.tags.some((t) => t.toLowerCase().includes(q))
      ) return false;
    }
    return true;
  });

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toUpperCase() ?? "OTHER";
    const type = ["PDF", "CSV", "JSON"].includes(ext) ? ext : file.type.startsWith("image/") ? "IMAGE" : "OTHER";
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
          riskId: form.riskId || undefined,
          remediationId: form.remediationId || undefined,
          folderId: form.folderId || undefined,
          expiresAt: form.expiresAt || undefined,
          description: form.description || undefined,
        };
        const res = await fetch("/api/evidence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed");
        setEvidence((prev) => [data.data, ...prev]);
        if (data.data.folder) {
          setFolders((prev) => prev.map((f) => f.id === data.data.folder.id ? { ...f, _count: { evidence: f._count.evidence + 1 } } : f));
        }
        setShowModal(false);
        setForm({ title: "", description: "", fileName: "", fileSize: 0, fileType: "PDF", storageKey: "", controlId: "", riskId: "", remediationId: "", folderId: "", tags: "", expiresAt: "" });
      } catch (err: any) { setError(err.message); }
    });
  }

  function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault();
    setFolderError("");
    startTransition(async () => {
      try {
        const res = await fetch("/api/evidence/folders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: folderName, description: folderDesc || undefined }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to create folder");
        setFolders((prev) => [...prev, data.data].sort((a, b) => a.name.localeCompare(b.name)));
        setShowFolderModal(false);
        setFolderName("");
        setFolderDesc("");
      } catch (err: any) { setFolderError(err.message); }
    });
  }

  const expiringCount = evidence.filter((e) => isExpiringSoon(e.expiresAt)).length;
  const expiredCount = evidence.filter((e) => isExpired(e.expiresAt)).length;
  const unfiledCount = evidence.filter((e) => !e.folder).length;
  const unmappedCount = evidence.filter((e) => !e.control && !e.risk && !e.remediation).length;

  return (
    <>
      <Header title="Evidence Locker" subtitle="Store, organize, and map compliance artifacts" />
      <main className="grc-page space-y-6">
        {(expiringCount > 0 || expiredCount > 0 || unmappedCount > 0) && (
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
            {unmappedCount > 0 && (
              <div className="flex items-center gap-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-4 py-3 text-sm font-medium text-blue-700 dark:text-blue-400">
                <Link2 className="h-4 w-4" />{unmappedCount} artifact{unmappedCount > 1 ? "s" : ""} not yet mapped to a control, risk, or remediation
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" placeholder="Search by title, filename, control, remediation, or tag..." className="w-full rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button onClick={() => setShowFolderModal(true)} className="flex items-center gap-2 rounded-lg border dark:border-gray-700 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
            <FolderPlus className="h-3.5 w-3.5" /> New Folder
          </button>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">
            <Plus className="h-3.5 w-3.5" /> Add Evidence
          </button>
        </div>

        {/* Folder chips */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFolderFilter("")}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              folderFilter === ""
                ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300"
                : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
            )}
          >
            <FolderOpen className="h-3.5 w-3.5" /> All ({evidence.length})
          </button>
          {folders.map((f) => (
            <button
              key={f.id}
              onClick={() => setFolderFilter(folderFilter === f.id ? "" : f.id)}
              title={f.description ?? undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                folderFilter === f.id
                  ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300"
                  : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              )}
            >
              <Folder className="h-3.5 w-3.5" /> {f.name} ({f._count.evidence})
            </button>
          ))}
          <button
            onClick={() => setFolderFilter(folderFilter === "UNFILED" ? "" : "UNFILED")}
            className={cn(
              "flex items-center gap-1.5 rounded-full border border-dashed px-3 py-1.5 text-xs font-medium transition-colors",
              folderFilter === "UNFILED"
                ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300"
                : "border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
            )}
          >
            Unfiled ({unfiledCount})
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
            {search || folderFilter ? "No evidence matching your filters." : "Evidence locker is empty. Add your first artifact."}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((item) => {
              const Icon = FILE_ICONS[item.fileType] ?? File;
              const expired = isExpired(item.expiresAt);
              const expiring = isExpiringSoon(item.expiresAt);
              const unmapped = !item.control && !item.risk && !item.remediation;
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

                  {/* Folder */}
                  {item.folder && (
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                      <Folder className="h-3 w-3" /> {item.folder.name}
                    </div>
                  )}

                  {/* Mappings */}
                  <div className="flex flex-col gap-1.5">
                    {item.control && (
                      <div className="flex items-center gap-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1.5">
                        <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">{item.control.controlCode}</span>
                        <span className="text-xs text-blue-500 dark:text-blue-400 truncate">{item.control.title}</span>
                      </div>
                    )}
                    {item.risk && (
                      <div className="flex items-center gap-1.5 rounded-lg bg-orange-50 dark:bg-orange-950/40 px-2.5 py-1.5">
                        <AlertTriangle className="h-3 w-3 flex-shrink-0 text-orange-500" />
                        <span className="text-xs font-mono font-bold text-orange-600 dark:text-orange-400">{item.risk.riskId}</span>
                        <span className="text-xs text-orange-500 dark:text-orange-400 truncate">{item.risk.title}</span>
                      </div>
                    )}
                    {item.remediation && (
                      <div className="flex items-center gap-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 px-2.5 py-1.5">
                        <Wrench className="h-3 w-3 flex-shrink-0 text-purple-500" />
                        <span className="text-xs text-purple-600 dark:text-purple-400 truncate">{item.remediation.title}</span>
                      </div>
                    )}
                    {unmapped && (
                      <div className="flex items-center gap-1.5 rounded-lg border border-dashed border-gray-200 dark:border-gray-700 px-2.5 py-1.5">
                        <Link2 className="h-3 w-3 text-gray-400" />
                        <span className="text-xs text-gray-400 dark:text-gray-500">Not mapped yet</span>
                      </div>
                    )}
                  </div>

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

      {/* Add evidence modal */}
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
                <input required className={inputCls} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. MFA Enrollment Screenshot – Q2 2026" />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Folder</label>
                <select className={inputCls} value={form.folderId} onChange={(e) => setForm((f) => ({ ...f, folderId: e.target.value }))}>
                  <option value="">Unfiled</option>
                  {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>

              <div className="rounded-xl border dark:border-gray-700 p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Map to... <span className="font-normal text-gray-400">(all optional — you can map later)</span>
                </p>
                <div>
                  <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Control</label>
                  <select className={inputCls} value={form.controlId} onChange={(e) => setForm((f) => ({ ...f, controlId: e.target.value }))}>
                    <option value="">No control linked</option>
                    {controls.map((c) => <option key={c.id} value={c.id}>{c.controlCode} – {c.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Remediation</label>
                  <select className={inputCls} value={form.remediationId} onChange={(e) => setForm((f) => ({ ...f, remediationId: e.target.value }))}>
                    <option value="">No remediation linked</option>
                    {remediations.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">Risk</label>
                  <select className={inputCls} value={form.riskId} onChange={(e) => setForm((f) => ({ ...f, riskId: e.target.value }))}>
                    <option value="">No risk linked</option>
                    {risks.map((r) => <option key={r.id} value={r.id}>{r.riskId} – {r.title}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Tags</label>
                  <input className={inputCls} value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder="mfa, q2-2026, audit" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Expires</label>
                  <input type="date" className={inputCls} value={form.expiresAt} onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))} />
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

      {/* New folder modal */}
      {showFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowFolderModal(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-2xl">
            <div className="flex items-center justify-between border-b dark:border-gray-800 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">New Folder</h2>
              <button onClick={() => setShowFolderModal(false)} className="rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-800"><X className="h-5 w-5 dark:text-gray-400" /></button>
            </div>
            <form onSubmit={handleCreateFolder} className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Folder Name *</label>
                <input required className={inputCls} value={folderName} onChange={(e) => setFolderName(e.target.value)} placeholder="e.g. 2026 NIST CSF Review, Pen Test 2025..." />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Description</label>
                <input className={inputCls} value={folderDesc} onChange={(e) => setFolderDesc(e.target.value)} placeholder="Optional description" />
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Tip: organize by assessment cycle (&quot;2026 NIST CSF Review&quot;), engagement (&quot;Pen Test Q3 2026&quot;), or year (&quot;FY2026 Audit&quot;).
              </p>
              {folderError && <p className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-600 dark:text-red-400">{folderError}</p>}
              <div className="flex gap-3 border-t dark:border-gray-800 pt-4">
                <button type="button" onClick={() => setShowFolderModal(false)} className="flex-1 rounded-lg border dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">Cancel</button>
                <button type="submit" disabled={isPending || !folderName.trim()} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                  {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  <FolderPlus className="h-4 w-4" /> Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
