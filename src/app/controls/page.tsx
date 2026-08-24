"use client";

import { Fragment, useState, useEffect, useMemo, useTransition } from "react";
import Header from "@/components/layout/Header";
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  XCircle,
  Minus,
  Tag,
  X,
  Loader2,
  Pencil,
  Upload,
  ChevronDown,
  ChevronRight,
  Search,
  FileCheck2,
  Lightbulb,
  FilterX,
} from "lucide-react";
import {
  cn,
  formatControlStatus,
  getControlStatusClasses,
  getCriticalityClasses,
  getMaturityClasses,
  getEvidenceSuggestions,
  formatFileSize,
  MATURITY_LABELS,
  CRITICALITY_OPTIONS,
} from "@/lib/utils";
import Link from "next/link";

type FrameworkMapping = {
  id: string;
  requirementId: string;
  requirement: {
    controlId: string;
    framework: { slug: string; name: string };
  };
};

type ControlRow = {
  id: string;
  controlCode: string;
  title: string;
  description: string;
  status: string;
  criticality: string;
  maturityLevel: number;
  implementationNotes: string | null;
  evidenceExamples: string | null;
  owner: string | null;
  category: string | null;
  tags: string[];
  frameworkMappings: FrameworkMapping[];
  _count: { evidence: number; remediations: number };
};

type FrameworkWithReqs = {
  id: string;
  name: string;
  slug: string;
  version: string;
  requirements: { id: string; controlId: string; category: string; title: string }[];
};

const STATUS_ICONS = {
  IMPLEMENTED: CheckCircle2,
  IN_PROGRESS: Clock,
  NOT_STARTED: XCircle,
  NOT_APPLICABLE: Minus,
};

const STATUS_OPTIONS = ["IMPLEMENTED", "IN_PROGRESS", "NOT_STARTED", "NOT_APPLICABLE"] as const;

const FRAMEWORK_COLORS: Record<string, string> = {
  NIST_CSF_2: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  CIS_V8_1: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
  PCI_DSS_4: "bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-800",
  ISO_27001_2022: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
};

const FRAMEWORK_SHORT: Record<string, string> = {
  NIST_CSF_2: "NIST",
  CIS_V8_1: "CIS",
  PCI_DSS_4: "PCI",
  ISO_27001_2022: "ISO",
};

const inputCls =
  "w-full rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
const filterCls =
  "w-full rounded-md border dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 px-2 py-1 text-[11px] font-normal focus:outline-none focus:ring-1 focus:ring-blue-500";

// ─── Evidence upload (inline, pre-linked to a control) ────────────────────

function EvidenceUploadForm({
  control,
  onUploaded,
  onClose,
}: {
  control: ControlRow;
  onUploaded: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    title: "",
    fileName: "",
    fileSize: 0,
    fileType: "PDF" as string,
    storageKey: "",
    tags: "",
  });
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toUpperCase() ?? "OTHER";
    const type = ["PDF", "CSV", "JSON"].includes(ext) ? ext : file.type.startsWith("image/") ? "IMAGE" : "OTHER";
    setForm((f) => ({
      ...f,
      fileName: file.name,
      fileSize: file.size,
      fileType: type,
      storageKey: `evidence/${Date.now()}-${file.name}`,
      title: f.title || file.name.replace(/\.[^.]+$/, ""),
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        const res = await fetch("/api/evidence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: form.title,
            fileName: form.fileName,
            fileSize: Number(form.fileSize),
            fileType: form.fileType,
            storageKey: form.storageKey,
            controlId: control.id,
            tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Upload failed");
        onUploaded();
        onClose();
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 p-4">
      <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">
        Upload evidence for {control.controlCode}
      </p>
      <label className="flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border-2 border-dashed border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-900 p-4 hover:border-blue-400 transition-colors">
        <Upload className="h-5 w-5 text-blue-400" />
        <span className="text-xs text-gray-500 dark:text-gray-400">{form.fileName || "Click to select a file"}</span>
        {form.fileSize > 0 && (
          <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">
            {formatFileSize(form.fileSize)} · {form.fileType}
          </span>
        )}
        <input type="file" className="hidden" onChange={handleFileSelect} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <input
          required
          className={inputCls}
          placeholder="Evidence title *"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        />
        <input
          className={inputCls}
          placeholder="Tags (comma-separated)"
          value={form.tags}
          onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
        />
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border dark:border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800">
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending || !form.fileName}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
          Save Evidence
        </button>
      </div>
    </form>
  );
}

// ─── Edit drawer ───────────────────────────────────────────────────────────

function EditDrawer({
  control,
  categories,
  onClose,
  onSaved,
}: {
  control: ControlRow;
  categories: string[];
  onClose: () => void;
  onSaved: (updated: ControlRow) => void;
}) {
  const [form, setForm] = useState({
    title: control.title,
    description: control.description,
    status: control.status,
    criticality: control.criticality ?? "MEDIUM",
    maturityLevel: control.maturityLevel ?? 0,
    implementationNotes: control.implementationNotes ?? "",
    evidenceExamples: control.evidenceExamples ?? "",
    owner: control.owner ?? "",
    category: control.category ?? "",
  });
  const [tags, setTags] = useState<string[]>(control.tags);
  const [tagInput, setTagInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  // Framework mapping editor state
  const [allFrameworks, setAllFrameworks] = useState<FrameworkWithReqs[]>([]);
  const [selectedReqIds, setSelectedReqIds] = useState<string[]>(
    control.frameworkMappings.map((m) => m.requirementId)
  );
  const [openFramework, setOpenFramework] = useState<string | null>(null);
  const [reqSearch, setReqSearch] = useState("");
  const [loadingFrameworks, setLoadingFrameworks] = useState(true);

  useEffect(() => {
    fetch("/api/frameworks?requirements=true")
      .then((r) => r.json())
      .then((d) => setAllFrameworks(d.data ?? []))
      .finally(() => setLoadingFrameworks(false));
  }, []);

  function addTag(raw: string) {
    const t = raw.trim().replace(/[;,]$/, "").trim();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagInput("");
  }

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
        const pendingTag = tagInput.trim();
        const finalTags = pendingTag && !tags.includes(pendingTag) ? [...tags, pendingTag] : tags;
        const res = await fetch(`/api/controls/${control.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            maturityLevel: Number(form.maturityLevel),
            tags: finalTags,
            frameworkRequirementIds: selectedReqIds,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to update control");
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
        <div className="sticky top-0 z-10 flex items-center justify-between border-b dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-4">
          <div>
            <p className="text-xs font-mono font-bold text-gray-400 dark:text-gray-500">{control.controlCode}</p>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Control Details</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="h-5 w-5 dark:text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Title *</label>
            <input required className={inputCls} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Description *</label>
            <textarea required rows={5} className={cn(inputCls, "resize-y")} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>

          {/* Status grid picker */}
          <div>
            <label className="mb-2 block text-xs font-semibold text-gray-700 dark:text-gray-300">Implementation Status *</label>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTIONS.map((status) => {
                const Icon = STATUS_ICONS[status];
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, status }))}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium transition-colors text-left",
                      form.status === status
                        ? getControlStatusClasses(status) + " ring-1 ring-current"
                        : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                    {formatControlStatus(status)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Implementation details */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
              Implementation Details <span className="font-normal text-gray-400">how this control is actually implemented</span>
            </label>
            <textarea
              rows={4}
              className={cn(inputCls, "resize-y")}
              value={form.implementationNotes}
              onChange={(e) => setForm((f) => ({ ...f, implementationNotes: e.target.value }))}
              placeholder="e.g. Okta MFA enforced for all staff via sign-on policy; hardware keys required for admins; exceptions tracked in..."
            />
          </div>

          {/* Criticality & Maturity */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-xs font-semibold text-gray-700 dark:text-gray-300">Criticality *</label>
              <div className="grid grid-cols-2 gap-1.5">
                {CRITICALITY_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, criticality: c }))}
                    className={cn(
                      "rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-colors",
                      form.criticality === c
                        ? getCriticalityClasses(c) + " ring-1 ring-current"
                        : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                Maturity Level: <span className={cn("rounded px-1.5 py-0.5", getMaturityClasses(Number(form.maturityLevel)))}>{form.maturityLevel} – {MATURITY_LABELS[Number(form.maturityLevel)]}</span>
              </label>
              <input
                type="range"
                min={0}
                max={5}
                step={1}
                value={form.maturityLevel}
                onChange={(e) => setForm((f) => ({ ...f, maturityLevel: Number(e.target.value) }))}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-[9px] text-gray-400">
                <span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
              </div>
            </div>
          </div>

          {/* Owner & Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Owner</label>
              <input className={inputCls} value={form.owner} onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))} placeholder="CISO, IT Security..." />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Category</label>
              <input
                className={inputCls}
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="Access Control, Network..."
                list="control-categories"
              />
              <datalist id="control-categories">
                {categories.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>

          {/* Evidence examples */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
              Suggested Evidence <span className="font-normal text-gray-400">what artifacts prove this control works</span>
            </label>
            <textarea
              rows={3}
              className={cn(inputCls, "resize-y")}
              value={form.evidenceExamples}
              onChange={(e) => setForm((f) => ({ ...f, evidenceExamples: e.target.value }))}
              placeholder={getEvidenceSuggestions(form.category || null).slice(0, 2).join("; ") + "..."}
            />
          </div>

          {/* Tags — chip editor */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
              Tags <span className="font-normal text-gray-400">press Enter to add · click × to remove</span>
            </label>
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1.5 focus-within:ring-2 focus-within:ring-blue-500">
              {tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:text-blue-300">
                  <Tag className="h-2.5 w-2.5" />
                  {tag}
                  <button
                    type="button"
                    onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                    className="ml-0.5 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800"
                    aria-label={`Remove ${tag}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                className="min-w-[120px] flex-1 border-none bg-transparent px-1 py-1 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "," || e.key === ";") {
                    e.preventDefault();
                    addTag(tagInput);
                  } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
                    setTags((prev) => prev.slice(0, -1));
                  }
                }}
                onBlur={() => tagInput.trim() && addTag(tagInput)}
                placeholder={tags.length === 0 ? "MFA, Encryption, Zero Trust..." : "Add tag..."}
              />
            </div>
          </div>

          {/* Framework mappings — editable */}
          <div>
            <label className="mb-2 block text-xs font-semibold text-gray-700 dark:text-gray-300">
              Framework Mappings <span className="font-normal text-gray-400">{selectedReqIds.length} requirement{selectedReqIds.length !== 1 ? "s" : ""} mapped</span>
            </label>
            {loadingFrameworks ? (
              <div className="flex items-center gap-2 rounded-lg border dark:border-gray-700 p-3 text-xs text-gray-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading frameworks...
              </div>
            ) : (
              <div className="space-y-2">
                {allFrameworks.map((fw) => {
                  const fwSelected = fw.requirements.filter((r) => selectedReqIds.includes(r.id));
                  const isOpen = openFramework === fw.slug;
                  const visibleReqs = isOpen
                    ? fw.requirements.filter((r) => {
                        if (!reqSearch) return true;
                        const q = reqSearch.toLowerCase();
                        return r.controlId.toLowerCase().includes(q) || r.title.toLowerCase().includes(q) || r.category.toLowerCase().includes(q);
                      })
                    : [];
                  return (
                    <div key={fw.slug} className="rounded-lg border dark:border-gray-700 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => { setOpenFramework(isOpen ? null : fw.slug); setReqSearch(""); }}
                        className="flex w-full items-center justify-between bg-gray-50 dark:bg-gray-800/60 px-3 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        <span className="flex items-center gap-2">
                          <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", FRAMEWORK_COLORS[fw.slug] ?? "bg-gray-100 text-gray-600")}>
                            {FRAMEWORK_SHORT[fw.slug] ?? fw.slug}
                          </span>
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{fw.name} v{fw.version}</span>
                        </span>
                        <span className="flex items-center gap-2">
                          <span className={cn("text-[11px] font-semibold", fwSelected.length > 0 ? "text-blue-600 dark:text-blue-400" : "text-gray-400")}>
                            {fwSelected.length} mapped
                          </span>
                          {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
                        </span>
                      </button>
                      {!isOpen && fwSelected.length > 0 && (
                        <div className="flex flex-wrap gap-1 px-3 py-2">
                          {fwSelected.slice(0, 8).map((r) => (
                            <span key={r.id} className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 font-mono text-[10px] text-gray-600 dark:text-gray-400">{r.controlId}</span>
                          ))}
                          {fwSelected.length > 8 && <span className="text-[10px] text-gray-400">+{fwSelected.length - 8} more</span>}
                        </div>
                      )}
                      {isOpen && (
                        <div className="p-2 space-y-2">
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
                            <input
                              className={cn(filterCls, "pl-6 py-1.5")}
                              placeholder={`Search ${fw.requirements.length} requirements...`}
                              value={reqSearch}
                              onChange={(e) => setReqSearch(e.target.value)}
                            />
                          </div>
                          <div className="max-h-48 space-y-0.5 overflow-y-auto">
                            {visibleReqs.map((r) => (
                              <label key={r.id} className="flex cursor-pointer items-start gap-2 rounded px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-800">
                                <input
                                  type="checkbox"
                                  className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300 text-blue-600"
                                  checked={selectedReqIds.includes(r.id)}
                                  onChange={() => toggleReq(r.id)}
                                />
                                <span className="min-w-0">
                                  <span className="font-mono text-[11px] font-bold text-gray-700 dark:text-gray-300">{r.controlId}</span>
                                  <span className="ml-1.5 text-[11px] text-gray-500 dark:text-gray-400">{r.title}</span>
                                </span>
                              </label>
                            ))}
                            {visibleReqs.length === 0 && (
                              <p className="px-2 py-3 text-center text-[11px] text-gray-400">No requirements match.</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="flex gap-3 border-t dark:border-gray-800 pt-4">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">
              Cancel
            </button>
            <button type="submit" disabled={isPending} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function ControlsPage() {
  const [controls, setControls] = useState<ControlRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editControl, setEditControl] = useState<ControlRow | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchFilter, setSearchFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [criticalityFilter, setCriticalityFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [frameworkFilter, setFrameworkFilter] = useState("");

  useEffect(() => {
    fetch("/api/controls?pageSize=200")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? `Failed to load controls (HTTP ${r.status})`);
        setControls(d.data ?? []);
      })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function handleSaved(updated: ControlRow) {
    setControls((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  function bumpEvidenceCount(controlId: string) {
    setControls((prev) =>
      prev.map((c) =>
        c.id === controlId ? { ...c, _count: { ...c._count, evidence: c._count.evidence + 1 } } : c
      )
    );
  }

  const statusCounts = {
    IMPLEMENTED: controls.filter((c) => c.status === "IMPLEMENTED").length,
    IN_PROGRESS: controls.filter((c) => c.status === "IN_PROGRESS").length,
    NOT_STARTED: controls.filter((c) => c.status === "NOT_STARTED").length,
    NOT_APPLICABLE: controls.filter((c) => c.status === "NOT_APPLICABLE").length,
  };

  const categories = useMemo(
    () => Array.from(new Set(controls.map((c) => c.category).filter(Boolean))).sort() as string[],
    [controls]
  );
  const owners = useMemo(
    () => Array.from(new Set(controls.map((c) => c.owner).filter(Boolean))).sort() as string[],
    [controls]
  );
  const frameworks = useMemo(() => {
    const set = new Set<string>();
    controls.forEach((c) => c.frameworkMappings.forEach((m) => set.add(m.requirement.framework.slug)));
    return Array.from(set);
  }, [controls]);

  const hasFilters = Boolean(statusFilter || searchFilter || categoryFilter || criticalityFilter || ownerFilter || frameworkFilter);

  const filtered = controls.filter((c) => {
    if (statusFilter && c.status !== statusFilter) return false;
    if (categoryFilter && c.category !== categoryFilter) return false;
    if (criticalityFilter && c.criticality !== criticalityFilter) return false;
    if (ownerFilter && c.owner !== ownerFilter) return false;
    if (frameworkFilter && !c.frameworkMappings.some((m) => m.requirement.framework.slug === frameworkFilter)) return false;
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      if (
        !c.controlCode.toLowerCase().includes(q) &&
        !c.title.toLowerCase().includes(q) &&
        !c.description.toLowerCase().includes(q) &&
        !c.tags.some((t) => t.toLowerCase().includes(q))
      )
        return false;
    }
    return true;
  });

  function clearFilters() {
    setStatusFilter("");
    setSearchFilter("");
    setCategoryFilter("");
    setCriticalityFilter("");
    setOwnerFilter("");
    setFrameworkFilter("");
  }

  return (
    <>
      <Header title="Controls Library" subtitle="Map once, comply to many frameworks" />
      <main className="grc-page space-y-6">
        {loadError && (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-5 py-4 text-sm text-red-700 dark:text-red-400">
            <strong>Couldn&apos;t load controls:</strong> {loadError}
            <button onClick={() => window.location.reload()} className="ml-3 rounded-lg border border-red-300 dark:border-red-700 px-2.5 py-1 text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900">Retry</button>
          </div>
        )}

        {/* Status summary — clickable filters */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(["IMPLEMENTED", "IN_PROGRESS", "NOT_STARTED", "NOT_APPLICABLE"] as const).map((status) => {
            const Icon = STATUS_ICONS[status];
            const active = statusFilter === status;
            return (
              <button
                key={status}
                onClick={() => setStatusFilter(active ? "" : status)}
                title={active ? "Click to clear filter" : `Filter table by ${formatControlStatus(status)}`}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-4 text-left transition-all cursor-pointer hover:shadow-md",
                  getControlStatusClasses(status),
                  active && "ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-gray-950"
                )}
              >
                <Icon className="h-5 w-5" />
                <div>
                  <p className="text-xl font-bold">{statusCounts[status]}</p>
                  <p className="text-xs">{formatControlStatus(status)}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Framework coverage banner */}
        {frameworks.length > 0 && (
          <div className="rounded-xl border bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 dark:border-blue-900/50 p-4">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              <ShieldCheck className="mr-1.5 inline-block h-4 w-4 text-blue-600 dark:text-blue-400" />
              Cross-framework coverage active across <strong>{frameworks.length}</strong> frameworks:{" "}
              {frameworks.map((s) => FRAMEWORK_SHORT[s] ?? s).join(", ")}. Each internal control maps to all relevant framework requirements.
            </p>
          </div>
        )}

        {/* Controls table */}
        <div className="overflow-hidden rounded-xl border dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <div className="flex items-center justify-between border-b dark:border-gray-800 px-6 py-4">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Internal Controls ({filtered.length}{hasFilters ? ` of ${controls.length}` : ""})
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
            <Link
              href="/controls/import"
              className="flex items-center gap-2 rounded-lg border dark:border-gray-700 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <Upload className="h-3.5 w-3.5" /> Import Controls
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th className="w-8"></th>
                  <th>Control</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Criticality</th>
                  <th>Maturity</th>
                  <th>Frameworks</th>
                  <th>Owner</th>
                  <th>Evidence</th>
                  <th className="w-16"></th>
                </tr>
                {/* Header filter row */}
                <tr className="bg-gray-50/70 dark:bg-gray-800/40">
                  <th></th>
                  <th className="py-2 pr-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
                      <input
                        className={cn(filterCls, "pl-6")}
                        placeholder="Search code, title, tag..."
                        value={searchFilter}
                        onChange={(e) => setSearchFilter(e.target.value)}
                      />
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
                      {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{formatControlStatus(s)}</option>)}
                    </select>
                  </th>
                  <th className="py-2 pr-2">
                    <select className={filterCls} value={criticalityFilter} onChange={(e) => setCriticalityFilter(e.target.value)}>
                      <option value="">All</option>
                      {CRITICALITY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </th>
                  <th></th>
                  <th className="py-2 pr-2">
                    <select className={filterCls} value={frameworkFilter} onChange={(e) => setFrameworkFilter(e.target.value)}>
                      <option value="">All</option>
                      {frameworks.map((f) => <option key={f} value={f}>{FRAMEWORK_SHORT[f] ?? f}</option>)}
                    </select>
                  </th>
                  <th className="py-2 pr-2">
                    <select className={filterCls} value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
                      <option value="">All owners</option>
                      {owners.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </th>
                  <th></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} className="py-16 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-300" />
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-16 text-center text-sm text-gray-400 dark:text-gray-500">
                      {hasFilters ? "No controls match the current filters." : "No controls found. Run the database seed to load sample data."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((control) => {
                    const Icon = STATUS_ICONS[control.status as keyof typeof STATUS_ICONS] ?? Minus;
                    const isExpanded = expandedId === control.id;
                    const fwMap = new Map<string, { slug: string; ids: string[] }>();
                    control.frameworkMappings.forEach((m) => {
                      const slug = m.requirement.framework.slug;
                      if (!fwMap.has(slug)) fwMap.set(slug, { slug, ids: [] });
                      fwMap.get(slug)!.ids.push(m.requirement.controlId);
                    });
                    const suggestions = control.evidenceExamples
                      ? control.evidenceExamples.split(/;|\n/).map((s) => s.trim()).filter(Boolean)
                      : getEvidenceSuggestions(control.category);

                    return (
                      <Fragment key={control.id}>
                        <tr
                          className={cn("hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer", isExpanded && "bg-blue-50/40 dark:bg-blue-950/20")}
                          onClick={() => setEditControl(control)}
                          title="Click to open control details"
                        >
                          <td className="pl-3">
                            <button
                              onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : control.id); }}
                              title={isExpanded ? "Collapse" : "Expand description & evidence"}
                              className="rounded p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700"
                            >
                              {isExpanded ? <ChevronDown className="h-4 w-4 text-blue-500" /> : <ChevronRight className="h-4 w-4 text-gray-400 dark:text-gray-500" />}
                            </button>
                          </td>
                          <td>
                            <div>
                              <p className="font-semibold text-gray-900 dark:text-gray-100 text-xs">{control.controlCode}</p>
                              <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 font-medium">{control.title}</p>
                              {control.tags.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {control.tags.slice(0, 3).map((tag) => (
                                    <span key={tag} className="inline-flex items-center gap-0.5 rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                                      <Tag className="h-2.5 w-2.5" />
                                      {tag}
                                    </span>
                                  ))}
                                  {control.tags.length > 3 && (
                                    <span className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-400">
                                      +{control.tags.length - 3}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="text-gray-500 dark:text-gray-400 text-xs">{control.category ?? "—"}</td>
                          <td>
                            <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap", getControlStatusClasses(control.status))}>
                              <Icon className="h-3 w-3" />
                              {formatControlStatus(control.status)}
                            </span>
                          </td>
                          <td>
                            <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold", getCriticalityClasses(control.criticality))}>
                              {control.criticality}
                            </span>
                          </td>
                          <td>
                            <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap", getMaturityClasses(control.maturityLevel))}>
                              L{control.maturityLevel} · {MATURITY_LABELS[control.maturityLevel]}
                            </span>
                          </td>
                          <td>
                            <div className="flex flex-wrap gap-1.5">
                              {Array.from(fwMap.entries()).map(([slug, info]) => (
                                <span key={slug} className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold", FRAMEWORK_COLORS[slug] ?? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400")}>
                                  {FRAMEWORK_SHORT[slug] ?? slug}
                                  <span className="ml-1 font-normal opacity-70">×{info.ids.length}</span>
                                </span>
                              ))}
                              {fwMap.size === 0 && <span className="text-xs text-gray-400">Unmapped</span>}
                            </div>
                          </td>
                          <td className="text-sm text-gray-600 dark:text-gray-400">
                            {control.owner ?? <span className="text-gray-300 dark:text-gray-600">—</span>}
                          </td>
                          <td>
                            <span className="inline-flex items-center gap-1 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-0.5 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                              {control._count.evidence} artifact{control._count.evidence !== 1 ? "s" : ""}
                            </span>
                          </td>
                          <td>
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditControl(control); }}
                              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-600 dark:hover:text-blue-400"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>

                        {/* Expanded detail row */}
                        {isExpanded && (
                          <tr className="bg-blue-50/40 dark:bg-blue-950/20">
                            <td></td>
                            <td colSpan={9} className="pb-4 pr-6">
                              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                {/* Description + implementation */}
                                <div className="rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
                                  <p className="mb-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">Description</p>
                                  <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">{control.description}</p>
                                  <p className="mb-1.5 mt-3 text-xs font-semibold text-gray-700 dark:text-gray-300">Implementation Details</p>
                                  {control.implementationNotes ? (
                                    <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line">{control.implementationNotes}</p>
                                  ) : (
                                    <p className="text-sm italic text-gray-400 dark:text-gray-500">Not documented yet — click the row to add how this control is implemented.</p>
                                  )}
                                </div>

                                {/* Evidence guidance + upload */}
                                <div className="rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
                                  <div className="mb-1.5 flex items-center justify-between">
                                    <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
                                      <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                                      Suggested Evidence
                                      {!control.evidenceExamples && <span className="font-normal text-gray-400">(auto-suggested from category)</span>}
                                    </p>
                                    {uploadingFor !== control.id && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setUploadingFor(control.id); }}
                                        className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700"
                                      >
                                        <FileCheck2 className="h-3 w-3" /> Upload Evidence
                                      </button>
                                    )}
                                  </div>
                                  <ul className="space-y-1">
                                    {suggestions.map((s, i) => (
                                      <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                                        <CheckCircle2 className="mt-0.5 h-3 w-3 flex-shrink-0 text-green-500" />
                                        {s}
                                      </li>
                                    ))}
                                  </ul>
                                  {uploadingFor === control.id && (
                                    <div onClick={(e) => e.stopPropagation()}>
                                      <EvidenceUploadForm
                                        control={control}
                                        onUploaded={() => bumpEvidenceCount(control.id)}
                                        onClose={() => setUploadingFor(null)}
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {editControl && (
        <EditDrawer control={editControl} categories={categories} onClose={() => setEditControl(null)} onSaved={handleSaved} />
      )}
    </>
  );
}
