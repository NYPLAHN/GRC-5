"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { useParams } from "next/navigation";
import { ShieldCheck, Loader2, CheckCircle2, AlertTriangle, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VraQuestion, VraAnswer } from "@/lib/vra";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; vendorName: string; alreadyCompleted: boolean; questions: VraQuestion[] };

const inputCls =
  "w-full rounded-lg border border-gray-300 bg-white text-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

export default function VendorVraPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;

  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [answers, setAnswers] = useState<Record<string, VraAnswer | "">>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [respondentName, setRespondentName] = useState("");
  const [respondentEmail, setRespondentEmail] = useState("");
  const [attested, setAttested] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    fetch(`/api/vra/${token}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Could not load the assessment.");
        setState({
          status: "done",
          vendorName: d.data.vendorName,
          alreadyCompleted: d.data.alreadyCompleted,
          questions: d.data.questions,
        });
      })
      .catch((e) => setState({ status: "error", message: e.message }));
  }, [token]);

  const questions = state.status === "done" ? state.questions : [];
  const sections = useMemo(() => {
    const map = new Map<string, VraQuestion[]>();
    questions.forEach((q) => {
      if (!map.has(q.domain)) map.set(q.domain, []);
      map.get(q.domain)!.push(q);
    });
    return Array.from(map.entries());
  }, [questions]);

  const answeredCount = Object.values(answers).filter(Boolean).length;
  const allAnswered = questions.length > 0 && answeredCount === questions.length;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!allAnswered) {
      setError(`Please answer all questions (${answeredCount}/${questions.length} answered).`);
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch(`/api/vra/${token}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            respondentName,
            respondentEmail,
            responses: Object.entries(answers)
              .filter(([, a]) => a)
              .map(([questionId, answer]) => ({
                questionId,
                answer,
                comment: comments[questionId] || undefined,
              })),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Submission failed.");
        setSubmitted(true);
        window.scrollTo({ top: 0 });
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Vendor Risk Assessment</h1>
            <p className="text-sm text-gray-500">The New York Public Library · Information Security</p>
          </div>
        </div>

        {state.status === "loading" && (
          <div className="flex justify-center rounded-2xl border bg-white py-20 shadow-sm">
            <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
          </div>
        )}

        {state.status === "error" && (
          <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
            <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-red-400" />
            <p className="text-sm text-gray-700">{state.message}</p>
            <p className="mt-2 text-xs text-gray-400">If you believe this is a mistake, contact your NYPL representative.</p>
          </div>
        )}

        {state.status === "done" && (submitted || state.alreadyCompleted) && (
          <div className="rounded-2xl border border-green-200 bg-white p-10 text-center shadow-sm">
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-green-500" />
            <h2 className="text-lg font-semibold text-gray-900">
              {submitted ? "Assessment submitted — thank you!" : "This assessment has already been submitted."}
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              NYPL&apos;s Information Security team will review your responses and follow up if anything needs clarification.
            </p>
          </div>
        )}

        {state.status === "done" && !submitted && !state.alreadyCompleted && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <p className="text-sm text-gray-700">
                Hello <strong>{state.vendorName}</strong> — NYPL uses this questionnaire to understand your
                information security posture. Please answer every question; where you answer
                <strong> No</strong>, a short explanation of compensating controls helps our review.
                Question references (§) map to NYPL&apos;s full VRA v4.0.
              </p>
              <div className="mt-4 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%` }} />
                </div>
                <span className="text-xs font-medium text-gray-500">{answeredCount}/{questions.length}</span>
              </div>
            </div>

            {sections.map(([domain, qs]) => (
              <div key={domain} className="rounded-2xl border bg-white shadow-sm overflow-hidden">
                <div className="border-b bg-gray-50 px-6 py-3">
                  <h3 className="text-sm font-bold text-gray-800">{domain}</h3>
                </div>
                <div className="divide-y">
                  {qs.map((q) => (
                    <div key={q.id} className="px-6 py-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <p className="text-sm text-gray-700">
                          <span className="mr-1.5 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-gray-500">§{q.section}</span>
                          {q.text}
                        </p>
                        <div className="flex flex-shrink-0 gap-1.5">
                          {(["YES", "NO", "NA"] as const).map((a) => (
                            <button key={a} type="button"
                              onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: a }))}
                              className={cn("rounded-lg px-3.5 py-1.5 text-xs font-bold transition-colors",
                                answers[q.id] === a
                                  ? a === "YES" ? "bg-green-600 text-white" : a === "NO" ? "bg-red-600 text-white" : "bg-gray-500 text-white"
                                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                              )}>{a === "NA" ? "N/A" : a.charAt(0) + a.slice(1).toLowerCase()}</button>
                          ))}
                        </div>
                      </div>
                      {(answers[q.id] === "NO" || answers[q.id] === "NA") && (
                        <textarea
                          rows={2}
                          className={cn(inputCls, "mt-3")}
                          placeholder={answers[q.id] === "NO" ? "Please describe compensating controls or plans to address this..." : "Please explain why this is not applicable..."}
                          value={comments[q.id] ?? ""}
                          onChange={(e) => setComments((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Attestation */}
            <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-gray-800">Attestation</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">Your Name *</label>
                  <input required className={inputCls} value={respondentName} onChange={(e) => setRespondentName(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">Your Email *</label>
                  <input required type="email" className={inputCls} value={respondentEmail} onChange={(e) => setRespondentEmail(e.target.value)} />
                </div>
              </div>
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" required checked={attested} onChange={(e) => setAttested(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600" />
                <span className="text-xs text-gray-600">
                  I attest that these answers are complete and correct to the best of my knowledge and accurately
                  reflect my company&apos;s actual practices, policies, procedures, and controls as of today&apos;s date.
                </span>
              </label>
              {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={isPending || !attested}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Submit Assessment to NYPL
              </button>
            </div>

            <p className="pb-6 text-center text-xs text-gray-400">Private and confidential · Submitted responses go directly to NYPL Information Security.</p>
          </form>
        )}
      </div>
    </div>
  );
}
