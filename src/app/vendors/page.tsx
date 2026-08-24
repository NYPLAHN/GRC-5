"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import Header from "@/components/layout/Header";
import {
  Building2, Plus, X, Loader2, Search, FilterX, Upload, Link2,
  ShieldCheck, ShieldAlert, KeyRound, Users, Cloud, Database,
  ClipboardList, CalendarClock, Copy, Check,
} from "lucide-react";
import {
  cn, formatDate, formatFileSize, getRiskBadgeClasses, CADENCE_LABELS,
  getCriticalityClasses, CRITICALITY_OPTIONS,
} from "@/lib/utils";
import {
  VRA_QUESTIONS, DATA_CATEGORIES, HOSTING_OPTIONS, computeVendorRiskScore,
  getVendorRiskRating, VRA_STATUS_LABELS, VENDOR_STATUS_LABELS, type VraAnswer,
} from "@/lib/vra";

type VraResponse = { questionId: string; answer: string; comment: string | null };

type Vendor = {
  id: string;
  vendorCode: string;
  name: string;
  description: string | null;
  website: string | null;
  applicationOwner: string | null;
  businessUnit: string | null;
  criticality: string;
  status: string;
  hosting: string | null;
  hostingDetails: string | null;
  ssoEnabled: boolean;
  mfaEnforced: boolean;
  userCount: number | null;
  accessControlNotes: string | null;
  storesNyplData: boolean;
  dataProcessed: string[];
  attestationType: string | null;
  cyberInsurance: boolean;
  securityContactName: string | null;
  securityContactEmail: string | null;
  riskScore: number | null;
  vraStatus: string;
  vraToken: string | null;
  vraCompletedAt: string | null;
  vraCompletedBy: string | null;
  vraFileName: string | null;
  vraFileSize: number | null;
  reviewCadence: string;
  lastReviewedAt: string | null;
  nextReviewDate: string | null;
  contractRenewal: string | null;
  notes: string | null;
  vraResponses: VraResponse[];
};

const inputCls =
  "w-full rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
const filterCls =
  "w-full rounded-md border dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 px-2 py-1 text-[11px] font-normal focus:outline-none focus:ring-1 focus:ring-blue-500";

const VRA_STATUS_COLORS: Record<string, string> = {
  NOT_STARTED: "bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
  SENT_TO_VENDOR: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800",
  IN_PROGRESS: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800",
  COMPLETED: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800",
  REVIEWED: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800",
};

function sectionTitle(text: string) {
  return <p className="border-b dark:border-gray-800 pb-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{text}</p>;
}

// ─── Vendor drawer (create + edit) ──────────────────────────────

function VendorDrawer({ vendor, onClose, onSaved }: {
  vendor?: Vendor;
  onClose: () => void;
  onSaved: (v: Vendor) => void;
}) {
  const isEdit = Boolean(vendor);
  const [form, setForm] = useState({
    name: vendor?.name ?? "",
    description: vendor?.description ?? "",
    website: vendor?.website ?? "",
    applicationOwner: vendor?.applicationOwner ?? "",
    businessUnit: vendor?.businessUnit ?? "",
    criticality: vendor?.criticality ?? "MEDIUM",
    status: vendor?.status ?? "ONBOARDING",
    hosting: vendor?.hosting ?? "SAAS_CLOUD",
    hostingDetails: vendor?.hostingDetails ?? "",
    ssoEnabled: vendor?.ssoEnabled ?? false,
    mfaEnforced: vendor?.mfaEnforced ?? false,
    userCount: vendor?.userCount?.toString() ?? "",
    accessControlNotes: vendor?.accessControlNotes ?? "",
    storesNyplData: vendor?.storesNyplData ?? false,
    attestationType: vendor?.attestationType ?? "",
    cyberInsurance: vendor?.cyberInsurance ?? false,
    securityContactName: vendor?.securityContactName ?? "",
    securityContactEmail: vendor?.securityContactEmail ?? "",
    reviewCadence: vendor?.reviewCadence ?? "ANNUAL",
    nextReviewDate: vendor?.nextReviewDate?.slice(0, 10) ?? "",
    contractRenewal: vendor?.contractRenewal?.slice(0, 10) ?? "",
    notes: vendor?.notes ?? "",
    vraFileName: vendor?.vraFileName ?? "",
    vraFileSize: vendor?.vraFileSize ?? 0,
    vraStorageKey: "",
  });
  const [dataProcessed, setDataProcessed] = useState<string[]>(vendor?.dataProcessed ?? []);
  const [answers, setAnswers] = useState<Record<string, VraAnswer | "">>(
    Object.fromEntries((vendor?.vraResponses ?? []).map((r) => [r.questionId, r.answer as VraAnswer]))
  );
  const [comments, setComments] = useState<Record<string, string>>(
    Object.fromEntries((vendor?.vraResponses ?? []).filter((r) => r.comment).map((r) => [r.questionId, r.comment as string]))
  );
  const [showChecklist, setShowChecklist] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [linkPending, startLinkTransition] = useTransition();
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [vraToken, setVraToken] = useState(vendor?.vraToken ?? null);

  // Live risk preview
  const breakdown = useMemo(() => computeVendorRiskScore(
    {
      criticality: form.criticality,
      dataProcessed,
      storesNyplData: form.storesNyplData,
      userCount: form.userCount ? Number(form.userCount) : null,
      hosting: form.hosting,
      ssoEnabled: form.ssoEnabled,
      mfaEnforced: form.mfaEnforced,
    },
    Object.entries(answers).filter(([, a]) => a).map(([questionId, answer]) => ({ questionId, answer: answer as string }))
  ), [form, dataProcessed, answers]);
  const rating = getVendorRiskRating(breakdown.total);

  function toggleData(label: string) {
    setDataProcessed((prev) => prev.includes(label) ? prev.filter((d) => d !== label) : [...prev, label]);
  }

  function handleVraFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setForm((f) => ({ ...f, vraFileName: file.name, vraFileSize: file.size, vraStorageKey: `vra/${Date.now()}-${file.name}` }));
  }

  function buildPayload() {
    const responses = Object.entries(answers)
      .filter(([, a]) => a)
      .map(([questionId, answer]) => ({
        questionId,
        answer: answer as VraAnswer,
        comment: comments[questionId] || undefined,
      }));
    return {
      name: form.name,
      description: form.description || undefined,
      website: form.website || undefined,
      applicationOwner: form.applicationOwner || undefined,
      businessUnit: form.businessUnit || undefined,
      criticality: form.criticality,
      status: form.status,
      hosting: form.hosting || undefined,
      hostingDetails: form.hostingDetails || undefined,
      ssoEnabled: form.ssoEnabled,
      mfaEnforced: form.mfaEnforced,
      userCount: form.userCount ? Number(form.userCount) : null,
      accessControlNotes: form.accessControlNotes || undefined,
      storesNyplData: form.storesNyplData,
      dataProcessed,
      attestationType: form.attestationType || undefined,
      cyberInsurance: form.cyberInsurance,
      securityContactName: form.securityContactName || undefined,
      securityContactEmail: form.securityContactEmail || undefined,
      reviewCadence: form.reviewCadence,
      nextReviewDate: form.nextReviewDate || (isEdit ? null : undefined),
      contractRenewal: form.contractRenewal || (isEdit ? null : undefined),
      notes: form.notes || undefined,
      ...(form.vraStorageKey ? { vraFileName: form.vraFileName, vraFileSize: Number(form.vraFileSize) || undefined, vraStorageKey: form.vraStorageKey } : {}),
      ...(isEdit && responses.length ? { responses } : {}),
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        const url = isEdit ? `/api/vendors/${vendor!.id}` : "/api/vendors";
        const res = await fetch(url, {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload()),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to save vendor");
        onSaved(data.data);
        onClose();
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  function handleGenerateLink() {
    setError("");
    startLinkTransition(async () => {
      try {
        const res = await fetch(`/api/vendors/${vendor!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ generateVraLink: true }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to generate link");
        setVraToken(data.data.vraToken);
        onSaved(data.data);
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  function copyLink() {
    if (!vraToken) return;
    navigator.clipboard.writeText(`${window.location.origin}/vra/${vraToken}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const answeredCount = Object.values(answers).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 h-full w-full max-w-2xl overflow-y-auto bg-white dark:bg-gray-900 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-4">
          <div>
            {isEdit && <p className="text-xs font-mono font-bold text-gray-400 dark:text-gray-500">{vendor!.vendorCode}</p>}
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{isEdit ? "Vendor Details" : "New Vendor"}</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className={cn("rounded-full border px-3 py-1 text-xs font-bold", getRiskBadgeClasses(rating))}>
              Risk {breakdown.total} · {rating}
            </span>
            <button onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-800">
              <X className="h-5 w-5 dark:text-gray-400" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          {/* ── Profile ── */}
          {sectionTitle("Profile")}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Vendor / Application Name *</label>
              <input required className={inputCls} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Workday, Sierra ILS..." />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">What it does</label>
              <textarea rows={2} className={cn(inputCls, "resize-y")} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Product/service description and business purpose..." />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Application Owner</label>
              <input className={inputCls} value={form.applicationOwner} onChange={(e) => setForm((f) => ({ ...f, applicationOwner: e.target.value }))} placeholder="NYPL owner (person)" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Business Unit</label>
              <input className={inputCls} value={form.businessUnit} onChange={(e) => setForm((f) => ({ ...f, businessUnit: e.target.value }))} placeholder="HR, Finance, IT, Branches..." />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Website</label>
              <input className={inputCls} value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} placeholder="vendor.com" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Vendor Status</label>
              <select className={inputCls} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                {Object.entries(VENDOR_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>

          {/* Criticality */}
          <div>
            <label className="mb-2 block text-xs font-semibold text-gray-700 dark:text-gray-300">Application Criticality *</label>
            <div className="grid grid-cols-4 gap-1.5">
              {CRITICALITY_OPTIONS.map((c) => (
                <button key={c} type="button" onClick={() => setForm((f) => ({ ...f, criticality: c }))}
                  className={cn("rounded-lg border px-2 py-2 text-[11px] font-semibold transition-colors",
                    form.criticality === c ? getCriticalityClasses(c) + " ring-1 ring-current"
                      : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                  )}>{c}</button>
              ))}
            </div>
          </div>

          {/* ── Hosting & Access ── */}
          {sectionTitle("Hosting & Access Control")}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Hosted</label>
              <select className={inputCls} value={form.hosting} onChange={(e) => setForm((f) => ({ ...f, hosting: e.target.value }))}>
                {HOSTING_OPTIONS.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Hosting Details</label>
              <input className={inputCls} value={form.hostingDetails} onChange={(e) => setForm((f) => ({ ...f, hostingDetails: e.target.value }))} placeholder="AWS us-east-1, vendor DC in NJ..." />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300"># of Users</label>
              <input type="number" min={0} className={inputCls} value={form.userCount} onChange={(e) => setForm((f) => ({ ...f, userCount: e.target.value }))} placeholder="e.g. 250" />
            </div>
            <div className="flex items-end gap-2 pb-1">
              <label className={cn("flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
                form.ssoEnabled ? "border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-400" : "border-gray-200 dark:border-gray-700 text-gray-500")}>
                <input type="checkbox" className="hidden" checked={form.ssoEnabled} onChange={(e) => setForm((f) => ({ ...f, ssoEnabled: e.target.checked }))} />
                <KeyRound className="h-3.5 w-3.5" /> SSO {form.ssoEnabled ? "✓" : ""}
              </label>
              <label className={cn("flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
                form.mfaEnforced ? "border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-400" : "border-gray-200 dark:border-gray-700 text-gray-500")}>
                <input type="checkbox" className="hidden" checked={form.mfaEnforced} onChange={(e) => setForm((f) => ({ ...f, mfaEnforced: e.target.checked }))} />
                <ShieldCheck className="h-3.5 w-3.5" /> MFA {form.mfaEnforced ? "✓" : ""}
              </label>
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Access Control Notes <span className="font-normal text-gray-400">how access is granted, reviewed, removed</span></label>
              <textarea rows={2} className={cn(inputCls, "resize-y")} value={form.accessControlNotes} onChange={(e) => setForm((f) => ({ ...f, accessControlNotes: e.target.value }))} placeholder="e.g. Provisioned via Okta group; quarterly access review by app owner; deprovisioned on HR term feed..." />
            </div>
          </div>

          {/* ── Data ── */}
          {sectionTitle("Data Processed")}
          <div>
            <label className="mb-2 flex cursor-pointer items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
              <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-blue-600" checked={form.storesNyplData} onChange={(e) => setForm((f) => ({ ...f, storesNyplData: e.target.checked }))} />
              Vendor stores NYPL data (VRA §2.1.1)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {DATA_CATEGORIES.map((d) => (
                <button key={d.label} type="button" onClick={() => toggleData(d.label)}
                  className={cn("rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors",
                    dataProcessed.includes(d.label)
                      ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300"
                      : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                  )}>{d.label}</button>
              ))}
            </div>
          </div>

          {/* ── Assurance ── */}
          {sectionTitle("Assurance & Contacts")}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Independent Attestation</label>
              <input className={inputCls} value={form.attestationType} onChange={(e) => setForm((f) => ({ ...f, attestationType: e.target.value }))} placeholder="SOC 2 Type II, ISO 27001..." list="attestations" />
              <datalist id="attestations">
                {["SOC 2 Type II", "SOC 2 Type I", "ISO 27001", "HiTrust", "None"].map((a) => <option key={a} value={a} />)}
              </datalist>
            </div>
            <div className="flex items-end pb-1">
              <label className={cn("flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
                form.cyberInsurance ? "border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-400" : "border-gray-200 dark:border-gray-700 text-gray-500")}>
                <input type="checkbox" className="hidden" checked={form.cyberInsurance} onChange={(e) => setForm((f) => ({ ...f, cyberInsurance: e.target.checked }))} />
                <ShieldAlert className="h-3.5 w-3.5" /> Cyber Insurance {form.cyberInsurance ? "✓" : ""}
              </label>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Security Contact</label>
              <input className={inputCls} value={form.securityContactName} onChange={(e) => setForm((f) => ({ ...f, securityContactName: e.target.value }))} placeholder="Name (VRA §1.1.6)" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Security Contact Email</label>
              <input type="email" className={inputCls} value={form.securityContactEmail} onChange={(e) => setForm((f) => ({ ...f, securityContactEmail: e.target.value }))} placeholder="security@vendor.com" />
            </div>
          </div>

          {/* ── Review cycle ── */}
          {sectionTitle("Review Cycle")}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Review Cadence</label>
              <select className={inputCls} value={form.reviewCadence} onChange={(e) => setForm((f) => ({ ...f, reviewCadence: e.target.value }))}>
                {Object.entries(CADENCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Next Review</label>
              <input type="date" className={inputCls} value={form.nextReviewDate} onChange={(e) => setForm((f) => ({ ...f, nextReviewDate: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Contract Renewal</label>
              <input type="date" className={inputCls} value={form.contractRenewal} onChange={(e) => setForm((f) => ({ ...f, contractRenewal: e.target.value }))} />
            </div>
          </div>

          {/* ── VRA ── */}
          {sectionTitle("Vendor Risk Assessment")}
          {isEdit && (
            <div className="rounded-xl border dark:border-gray-700 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className={cn("rounded-full border px-2.5 py-1 text-xs font-medium", VRA_STATUS_COLORS[vendor!.vraStatus])}>
                  VRA: {VRA_STATUS_LABELS[vendor!.vraStatus]}
                </span>
                {vendor!.vraCompletedBy && (
                  <span className="text-[11px] text-gray-400">Submitted by {vendor!.vraCompletedBy}{vendor!.vraCompletedAt ? ` · ${formatDate(vendor!.vraCompletedAt)}` : ""}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={handleGenerateLink} disabled={linkPending}
                  className="flex items-center gap-1.5 rounded-lg border border-blue-300 dark:border-blue-700 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 disabled:opacity-50">
                  {linkPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
                  {vraToken ? "Regenerate status" : "Create vendor link"}
                </button>
                {vraToken && (
                  <button type="button" onClick={copyLink}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copied ? "Copied!" : "Copy link to send vendor"}
                  </button>
                )}
              </div>
              {vraToken && (
                <p className="break-all rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2 font-mono text-[10px] text-gray-500 dark:text-gray-400">
                  {typeof window !== "undefined" ? window.location.origin : ""}/vra/{vraToken}
                </p>
              )}
            </div>
          )}

          {/* Upload completed VRA doc */}
          <label className="flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-4 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors">
            <Upload className="h-5 w-5 text-gray-400" />
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
              {form.vraFileName || "Attach completed VRA document (PDF/DOCX)"}
            </span>
            {Number(form.vraFileSize) > 0 && <span className="text-[10px] text-blue-600 dark:text-blue-400">{formatFileSize(Number(form.vraFileSize))}</span>}
            <input type="file" className="hidden" onChange={handleVraFile} />
          </label>

          {/* Checklist */}
          {isEdit && (
            <div className="rounded-xl border dark:border-gray-700 overflow-hidden">
              <button type="button" onClick={() => setShowChecklist(!showChecklist)}
                className="flex w-full items-center justify-between bg-gray-50 dark:bg-gray-800/60 px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-800">
                <span className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
                  <ClipboardList className="h-4 w-4 text-blue-500" />
                  VRA Checklist — {answeredCount}/{VRA_QUESTIONS.length} answered
                  <span className="font-normal text-gray-400">(fill from an uploaded VRA, or let the vendor answer via link)</span>
                </span>
                <span className="text-xs text-blue-600">{showChecklist ? "Hide" : "Show"}</span>
              </button>
              {showChecklist && (
                <div className="max-h-96 space-y-3 overflow-y-auto p-4">
                  {VRA_QUESTIONS.map((q) => (
                    <div key={q.id} className="rounded-lg border dark:border-gray-700 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-xs text-gray-700 dark:text-gray-300">
                          <span className="mr-1.5 rounded bg-gray-100 dark:bg-gray-800 px-1 py-0.5 font-mono text-[9px] font-bold text-gray-500">§{q.section}</span>
                          {q.text}
                        </p>
                        <div className="flex flex-shrink-0 gap-1">
                          {(["YES", "NO", "NA"] as const).map((a) => (
                            <button key={a} type="button"
                              onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: prev[q.id] === a ? "" : a }))}
                              className={cn("rounded px-2 py-1 text-[10px] font-bold transition-colors",
                                answers[q.id] === a
                                  ? a === "YES" ? "bg-green-600 text-white" : a === "NO" ? "bg-red-600 text-white" : "bg-gray-500 text-white"
                                  : "bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
                              )}>{a}</button>
                          ))}
                        </div>
                      </div>
                      {answers[q.id] === "NO" && (
                        <input
                          className={cn(inputCls, "mt-2 text-xs")}
                          placeholder="Context / compensating controls..."
                          value={comments[q.id] ?? ""}
                          onChange={(e) => setComments((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Risk breakdown ── */}
          <div className={cn("rounded-xl border p-4", getRiskBadgeClasses(rating))}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold">Risk Score: {breakdown.total} / 100 · {rating}</p>
              <p className="text-[11px] opacity-70">Exposure {breakdown.exposure} + Posture gap {breakdown.postureGap} {breakdown.reductions !== 0 ? `− ${Math.abs(breakdown.reductions)} (SSO/MFA)` : ""}</p>
            </div>
            {breakdown.gaps.length > 0 && (
              <p className="mt-1.5 text-[11px] opacity-80">
                Top gaps: {breakdown.gaps.sort((a, b) => b.weight - a.weight).slice(0, 3).map((g) => g.text.split(" ").slice(0, 5).join(" ") + "…").join(" · ")}
              </p>
            )}
            <p className="mt-1 text-[10px] opacity-60">Recalculates live; saved on submit. Unanswered checklist items count as risk.</p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">Internal Notes</label>
            <textarea rows={2} className={cn(inputCls, "resize-y")} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>

          {error && <p className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex gap-3 border-t dark:border-gray-800 pt-4">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">Cancel</button>
            <button type="submit" disabled={isPending} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Add Vendor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showDrawer, setShowDrawer] = useState(false);
  const [editVendor, setEditVendor] = useState<Vendor | null>(null);

  const [ratingFilter, setRatingFilter] = useState("");
  const [vraOutstandingFilter, setVraOutstandingFilter] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [critFilter, setCritFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [hostingFilter, setHostingFilter] = useState("");
  const [vraFilter, setVraFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");

  useEffect(() => {
    fetch("/api/vendors")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? `Failed to load vendors (HTTP ${r.status})`);
        setVendors(d.data ?? []);
      })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function handleSaved(saved: Vendor) {
    setVendors((prev) => {
      const exists = prev.find((v) => v.id === saved.id);
      return exists ? prev.map((v) => (v.id === saved.id ? saved : v)) : [...prev, saved].sort((a, b) => a.vendorCode.localeCompare(b.vendorCode));
    });
    // keep drawer state fresh after link generation
    setEditVendor((prev) => (prev && prev.id === saved.id ? saved : prev));
  }

  const owners = useMemo(() => Array.from(new Set(vendors.map((v) => v.applicationOwner).filter(Boolean))).sort() as string[], [vendors]);

  const ratingOf = (v: Vendor) => getVendorRiskRating(v.riskScore ?? 50);
  const vraOutstanding = (v: Vendor) => v.status !== "OFFBOARDED" && v.vraStatus !== "COMPLETED" && v.vraStatus !== "REVIEWED";
  const reviewOverdue = (v: Vendor) => Boolean(v.status !== "OFFBOARDED" && v.nextReviewDate && new Date(v.nextReviewDate) < new Date());

  const hasFilters = Boolean(ratingFilter || vraOutstandingFilter || searchFilter || critFilter || statusFilter || hostingFilter || vraFilter || ownerFilter);

  const filtered = vendors.filter((v) => {
    if (ratingFilter && ratingOf(v) !== ratingFilter) return false;
    if (vraOutstandingFilter && !vraOutstanding(v)) return false;
    if (critFilter && v.criticality !== critFilter) return false;
    if (statusFilter && v.status !== statusFilter) return false;
    if (hostingFilter && v.hosting !== hostingFilter) return false;
    if (vraFilter && v.vraStatus !== vraFilter) return false;
    if (ownerFilter && v.applicationOwner !== ownerFilter) return false;
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      if (
        !v.name.toLowerCase().includes(q) &&
        !v.vendorCode.toLowerCase().includes(q) &&
        !(v.description ?? "").toLowerCase().includes(q) &&
        !(v.applicationOwner ?? "").toLowerCase().includes(q) &&
        !v.dataProcessed.some((d) => d.toLowerCase().includes(q))
      ) return false;
    }
    return true;
  });

  function clearFilters() {
    setRatingFilter(""); setVraOutstandingFilter(false); setSearchFilter(""); setCritFilter("");
    setStatusFilter(""); setHostingFilter(""); setVraFilter(""); setOwnerFilter("");
  }

  const active = vendors.filter((v) => v.status !== "OFFBOARDED");
  const outstandingCount = vendors.filter(vraOutstanding).length;

  return (
    <>
      <Header title="Vendor Risk Management" subtitle="Track critical vendors, access controls, data exposure, and risk" />
      <main className="grc-page space-y-6">
        {loadError && (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-5 py-4 text-sm text-red-700 dark:text-red-400">
            <strong>Couldn&apos;t load vendors:</strong> {loadError}
            {loadError.toLowerCase().includes("does not exist") && (
              <span className="block mt-1 text-xs">Run <code className="rounded bg-red-100 dark:bg-red-900 px-1">npm run db:push</code> to add the new Vendor tables, then restart.</span>
            )}
            <button onClick={() => window.location.reload()} className="ml-3 rounded-lg border border-red-300 dark:border-red-700 px-2.5 py-1 text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900">Retry</button>
          </div>
        )}

        {/* Clickable risk-rating cards + VRA outstanding */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((r) => {
            const count = active.filter((v) => ratingOf(v) === r).length;
            const isActive = ratingFilter === r;
            return (
              <button key={r} onClick={() => setRatingFilter(isActive ? "" : r)}
                title={isActive ? "Click to clear filter" : `Filter by ${r} risk vendors`}
                className={cn("flex items-center gap-3 rounded-xl border p-4 text-left transition-all cursor-pointer hover:shadow-md",
                  getRiskBadgeClasses(r), isActive && "ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-gray-950")}>
                <Building2 className="h-5 w-5" />
                <div><p className="text-xl font-bold">{count}</p><p className="text-xs font-medium">{r} RISK</p></div>
              </button>
            );
          })}
          <button onClick={() => setVraOutstandingFilter(!vraOutstandingFilter)}
            title="Vendors without a completed VRA"
            className={cn("flex items-center gap-3 rounded-xl border p-4 text-left transition-all cursor-pointer hover:shadow-md",
              "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800",
              vraOutstandingFilter && "ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-gray-950")}>
            <ClipboardList className="h-5 w-5" />
            <div><p className="text-xl font-bold">{outstandingCount}</p><p className="text-xs font-medium">VRA OUTSTANDING</p></div>
          </button>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <div className="flex items-center justify-between border-b dark:border-gray-800 px-6 py-4">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Vendors ({filtered.length}{hasFilters ? ` of ${vendors.length}` : ""})
              </h2>
              {hasFilters && (
                <button onClick={clearFilters} className="flex items-center gap-1 rounded-full border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 px-2.5 py-1 text-[11px] font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900">
                  <FilterX className="h-3 w-3" /> Clear filters
                </button>
              )}
            </div>
            <button onClick={() => { setEditVendor(null); setShowDrawer(true); }}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">
              <Plus className="h-3.5 w-3.5" /> Add Vendor
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Criticality</th>
                  <th>Risk Score</th>
                  <th>Hosting</th>
                  <th>SSO / MFA</th>
                  <th>Users</th>
                  <th>Data Processed</th>
                  <th>VRA</th>
                  <th>Next Review</th>
                </tr>
                <tr className="bg-gray-50/70 dark:bg-gray-800/40">
                  <th className="py-2 pr-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
                      <input className={cn(filterCls, "pl-6")} placeholder="Search name, owner, data..." value={searchFilter} onChange={(e) => setSearchFilter(e.target.value)} />
                    </div>
                  </th>
                  <th className="py-2 pr-2">
                    <select className={filterCls} value={critFilter} onChange={(e) => setCritFilter(e.target.value)}>
                      <option value="">All</option>
                      {CRITICALITY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </th>
                  <th className="py-2 pr-2">
                    <select className={filterCls} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                      <option value="">All statuses</option>
                      {Object.entries(VENDOR_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </th>
                  <th className="py-2 pr-2">
                    <select className={filterCls} value={hostingFilter} onChange={(e) => setHostingFilter(e.target.value)}>
                      <option value="">All hosting</option>
                      {HOSTING_OPTIONS.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
                    </select>
                  </th>
                  <th></th>
                  <th></th>
                  <th className="py-2 pr-2">
                    <select className={filterCls} value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
                      <option value="">All owners</option>
                      {owners.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </th>
                  <th className="py-2 pr-2">
                    <select className={filterCls} value={vraFilter} onChange={(e) => setVraFilter(e.target.value)}>
                      <option value="">All VRA</option>
                      {Object.entries(VRA_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-300" /></td></tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-sm text-gray-400 dark:text-gray-500">
                      {hasFilters ? "No vendors match the current filters." : (
                        <span className="flex flex-col items-center gap-2">
                          <Building2 className="h-8 w-8 text-gray-200 dark:text-gray-700" />
                          No vendors yet. Add your first vendor to start tracking third-party risk.
                        </span>
                      )}
                    </td>
                  </tr>
                ) : filtered.map((v) => {
                  const r = ratingOf(v);
                  const overdue = reviewOverdue(v);
                  return (
                    <tr key={v.id} onClick={() => { setEditVendor(v); setShowDrawer(true); }} title="Click to open vendor details" className="cursor-pointer">
                      <td>
                        <p className="font-mono text-xs font-bold text-gray-500 dark:text-gray-400">{v.vendorCode}</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{v.name}</p>
                        <p className="text-[11px] text-gray-400">{v.applicationOwner ? `Owner: ${v.applicationOwner}` : "No owner assigned"}{v.businessUnit ? ` · ${v.businessUnit}` : ""}</p>
                      </td>
                      <td><span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold", getCriticalityClasses(v.criticality))}>{v.criticality}</span></td>
                      <td>
                        <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold whitespace-nowrap", getRiskBadgeClasses(r))}>
                          {v.riskScore ?? "—"} <span className="font-semibold opacity-80">· {r}</span>
                        </span>
                      </td>
                      <td className="text-xs whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-400">
                          <Cloud className="h-3 w-3 text-gray-400" />
                          {HOSTING_OPTIONS.find((h) => h.value === v.hosting)?.label ?? "—"}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <span className={cn("rounded border px-1.5 py-0.5 text-[9px] font-bold", v.ssoEnabled ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400" : "border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-700 dark:bg-gray-800")}>SSO</span>
                          <span className={cn("rounded border px-1.5 py-0.5 text-[9px] font-bold", v.mfaEnforced ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400" : "border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-700 dark:bg-gray-800")}>MFA</span>
                        </div>
                      </td>
                      <td className="text-xs text-gray-600 dark:text-gray-400">
                        <span className="inline-flex items-center gap-1"><Users className="h-3 w-3 text-gray-400" />{v.userCount ?? "—"}</span>
                      </td>
                      <td>
                        <div className="flex max-w-[180px] flex-wrap gap-1">
                          {v.dataProcessed.slice(0, 2).map((d) => (
                            <span key={d} className="inline-flex items-center gap-0.5 rounded bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 px-1.5 py-0.5 text-[9px] font-medium text-purple-700 dark:text-purple-300">
                              <Database className="h-2.5 w-2.5" />{d}
                            </span>
                          ))}
                          {v.dataProcessed.length > 2 && <span className="text-[9px] text-gray-400">+{v.dataProcessed.length - 2}</span>}
                          {v.dataProcessed.length === 0 && <span className="text-xs text-gray-300 dark:text-gray-600">—</span>}
                        </div>
                      </td>
                      <td>
                        <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium whitespace-nowrap", VRA_STATUS_COLORS[v.vraStatus])}>
                          {VRA_STATUS_LABELS[v.vraStatus]}
                        </span>
                      </td>
                      <td>
                        {v.nextReviewDate ? (
                          <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap",
                            overdue ? "bg-red-50 border-red-200 text-red-600 dark:bg-red-950 dark:border-red-800 dark:text-red-400"
                              : "bg-gray-50 border-gray-200 text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400")}>
                            {overdue && <CalendarClock className="h-2.5 w-2.5" />}
                            {formatDate(v.nextReviewDate)}{overdue && " · OVERDUE"}
                          </span>
                        ) : <span className="text-xs text-gray-300 dark:text-gray-600">—</span>}
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
        <VendorDrawer
          vendor={editVendor ?? undefined}
          onClose={() => { setShowDrawer(false); setEditVendor(null); }}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
