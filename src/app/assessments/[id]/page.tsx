import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { enforcePermission } from "@/lib/rbac";
import Header from "@/components/layout/Header";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  XCircle,
  MinusCircle,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";

const FUNCTION_META: Record<
  string,
  { label: string; abbr: string; color: string; bg: string; border: string }
> = {
  GOVERN: {
    label: "GOVERN",
    abbr: "GV",
    color: "text-purple-700 dark:text-purple-300",
    bg: "bg-purple-50 dark:bg-purple-950/40",
    border: "border-purple-200 dark:border-purple-800",
  },
  IDENTIFY: {
    label: "IDENTIFY",
    abbr: "ID",
    color: "text-blue-700 dark:text-blue-300",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-200 dark:border-blue-800",
  },
  PROTECT: {
    label: "PROTECT",
    abbr: "PR",
    color: "text-green-700 dark:text-green-300",
    bg: "bg-green-50 dark:bg-green-950/40",
    border: "border-green-200 dark:border-green-800",
  },
  DETECT: {
    label: "DETECT",
    abbr: "DE",
    color: "text-yellow-700 dark:text-yellow-300",
    bg: "bg-yellow-50 dark:bg-yellow-950/40",
    border: "border-yellow-200 dark:border-yellow-800",
  },
  RESPOND: {
    label: "RESPOND",
    abbr: "RS",
    color: "text-orange-700 dark:text-orange-300",
    bg: "bg-orange-50 dark:bg-orange-950/40",
    border: "border-orange-200 dark:border-orange-800",
  },
  RECOVER: {
    label: "RECOVER",
    abbr: "RC",
    color: "text-teal-700 dark:text-teal-300",
    bg: "bg-teal-50 dark:bg-teal-950/40",
    border: "border-teal-200 dark:border-teal-800",
  },
};

const STATUS_META: Record<
  string,
  { label: string; color: string; icon: typeof CheckCircle2 }
> = {
  COMPLIANT: {
    label: "Compliant",
    color: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-800",
    icon: CheckCircle2,
  },
  PARTIAL: {
    label: "Partial",
    color: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-400 dark:border-yellow-800",
    icon: AlertCircle,
  },
  NON_COMPLIANT: {
    label: "Non-Compliant",
    color: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800",
    icon: XCircle,
  },
  NOT_APPLICABLE: {
    label: "N/A",
    color: "bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
    icon: MinusCircle,
  },
};

async function getAssessment(id: string) {
  const assessment = await prisma.assessment.findUnique({
    where: { id },
    include: {
      conductor: { select: { id: true, name: true, version: true, slug: true } },
      results: {
        include: {
          control: { select: { id: true, controlCode: true, title: true, status: true } },
          requirement: {
            select: {
              id: true,
              controlId: true,
              category: true,
              subCategory: true,
              title: true,
            },
          },
        },
        orderBy: [
          { requirement: { category: "asc" } },
          { requirement: { controlId: "asc" } },
        ],
      },
    },
  });
  return assessment;
}

export default async function AssessmentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireAuth();
  enforcePermission(user.role, "assessments:read");

  const assessment = await getAssessment(params.id);
  if (!assessment) notFound();

  const total = assessment.results.length;
  const compliant = assessment.results.filter((r) => r.status === "COMPLIANT").length;
  const partial = assessment.results.filter((r) => r.status === "PARTIAL").length;
  const nonCompliant = assessment.results.filter((r) => r.status === "NON_COMPLIANT").length;
  const notApplicable = assessment.results.filter((r) => r.status === "NOT_APPLICABLE").length;
  const score = total > 0 ? Math.round(((compliant + partial * 0.5) / total) * 100) : 0;

  // Group results by NIST function
  const FUNCTION_ORDER = ["GOVERN", "IDENTIFY", "PROTECT", "DETECT", "RESPOND", "RECOVER"];
  const byFunction = FUNCTION_ORDER.map((fn) => ({
    fn,
    results: assessment.results.filter((r) => r.requirement?.category === fn),
  })).filter((g) => g.results.length > 0);

  // Per-function summary
  const functionStats = byFunction.map(({ fn, results: res }) => {
    const fnTotal = res.length;
    const fnCompliant = res.filter((r) => r.status === "COMPLIANT").length;
    const fnPartial = res.filter((r) => r.status === "PARTIAL").length;
    const fnNonCompliant = res.filter((r) => r.status === "NON_COMPLIANT").length;
    const fnScore = fnTotal > 0 ? Math.round(((fnCompliant + fnPartial * 0.5) / fnTotal) * 100) : 0;
    return { fn, fnTotal, fnCompliant, fnPartial, fnNonCompliant, fnScore };
  });

  const scoreColor =
    score >= 80
      ? "text-green-600 dark:text-green-400"
      : score >= 60
      ? "text-yellow-600 dark:text-yellow-400"
      : "text-red-600 dark:text-red-400";

  return (
    <>
      <Header
        title={assessment.title}
        subtitle={`${assessment.conductor.name} v${assessment.conductor.version} · ${new Date(assessment.startDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`}
      />

      <main className="grc-page space-y-6">
        {/* Back nav */}
        <Link
          href="/assessments"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Assessments
        </Link>

        {/* Overview row */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {/* Score */}
          <div className="col-span-2 sm:col-span-1 rounded-xl border dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm flex flex-col items-center justify-center">
            <p className={cn("text-4xl font-bold", scoreColor)}>{score}%</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Overall Score</p>
          </div>
          <div className="rounded-xl border dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{compliant}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Compliant</p>
          </div>
          <div className="rounded-xl border dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{partial}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Partial</p>
          </div>
          <div className="rounded-xl border dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{nonCompliant}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Non-Compliant</p>
          </div>
          <div className="rounded-xl border dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
            <p className="text-2xl font-bold text-gray-400 dark:text-gray-500">{notApplicable}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Not Applicable</p>
          </div>
        </div>

        {/* NIST Function Summary Row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {functionStats.map(({ fn, fnTotal, fnCompliant, fnPartial, fnNonCompliant, fnScore }) => {
            const meta = FUNCTION_META[fn] ?? { label: fn, abbr: fn.slice(0, 2), color: "text-gray-700", bg: "bg-gray-50", border: "border-gray-200" };
            const fnScoreColor =
              fnScore >= 80 ? "text-green-600 dark:text-green-400"
                : fnScore >= 60 ? "text-yellow-600 dark:text-yellow-400"
                : "text-red-600 dark:text-red-400";
            return (
              <div
                key={fn}
                className={cn("rounded-xl border p-4 shadow-sm", meta.bg, meta.border)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={cn("text-xs font-bold uppercase tracking-wide", meta.color)}>{meta.abbr}</span>
                  <span className={cn("text-sm font-bold", fnScoreColor)}>{fnScore}%</span>
                </div>
                <p className={cn("text-[10px] font-semibold uppercase tracking-wider truncate", meta.color)}>{meta.label}</p>
                {/* Mini progress bar */}
                <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-white/60 dark:bg-gray-700/60">
                  <div className="bg-green-500 transition-all" style={{ width: `${(fnCompliant / fnTotal) * 100}%` }} />
                  <div className="bg-yellow-400 transition-all" style={{ width: `${(fnPartial / fnTotal) * 100}%` }} />
                  <div className="bg-red-400 transition-all" style={{ width: `${(fnNonCompliant / fnTotal) * 100}%` }} />
                </div>
                <p className="mt-1.5 text-[10px] text-gray-500 dark:text-gray-400">
                  {fnCompliant}✓ {fnPartial > 0 ? `${fnPartial}~ ` : ""}{fnNonCompliant > 0 ? `${fnNonCompliant}✗` : ""} of {fnTotal}
                </p>
              </div>
            );
          })}
        </div>

        {/* Findings — grouped by function */}
        {byFunction.map(({ fn, results }) => {
          const meta = FUNCTION_META[fn] ?? { label: fn, abbr: fn.slice(0, 2), color: "text-gray-700", bg: "bg-gray-50", border: "border-gray-200" };
          return (
            <div key={fn} className="overflow-hidden rounded-xl border dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
              {/* Function header */}
              <div className={cn("flex items-center gap-3 border-b px-6 py-4", meta.bg, meta.border)}>
                <span className={cn("rounded-lg px-2.5 py-1 text-xs font-bold uppercase tracking-wide border", meta.bg, meta.color, meta.border)}>
                  {meta.abbr}
                </span>
                <div>
                  <p className={cn("text-sm font-semibold", meta.color)}>{meta.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {results.filter((r) => r.status === "COMPLIANT").length} compliant ·{" "}
                    {results.filter((r) => r.status === "PARTIAL").length} partial ·{" "}
                    {results.filter((r) => r.status === "NON_COMPLIANT").length} non-compliant
                    {" "}of {results.length}
                  </p>
                </div>
              </div>

              {/* Findings table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b dark:border-gray-800">
                    <tr className="bg-gray-50 dark:bg-gray-800/50 text-left">
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 w-28">Req. ID</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Sub-Category &amp; Title</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 w-32">Control</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 w-36">Status</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 w-16 text-center">Score</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-gray-800">
                    {results.map((result) => {
                      const statusMeta = STATUS_META[result.status] ?? STATUS_META.NOT_APPLICABLE;
                      const StatusIcon = statusMeta.icon;
                      return (
                        <tr key={result.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs font-semibold text-gray-700 dark:text-gray-300">
                              {result.requirement?.controlId ?? "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs font-medium text-gray-900 dark:text-gray-100 leading-snug">
                              {result.requirement?.title ?? "—"}
                            </p>
                            {result.requirement?.subCategory && (
                              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                                {result.requirement.subCategory}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {result.control ? (
                              <Link href="/controls" className="group">
                                <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400 group-hover:underline">
                                  {result.control.controlCode}
                                </span>
                                <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate max-w-[120px]">
                                  {result.control.title}
                                </p>
                              </Link>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap",
                                statusMeta.color
                              )}
                            >
                              <StatusIcon className="h-3 w-3" />
                              {statusMeta.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {result.score != null ? (
                              <span
                                className={cn(
                                  "font-bold text-xs",
                                  result.score >= 80 ? "text-green-600 dark:text-green-400"
                                    : result.score >= 50 ? "text-yellow-600 dark:text-yellow-400"
                                    : "text-red-600 dark:text-red-400"
                                )}
                              >
                                {result.score}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs">
                              {result.notes ?? "—"}
                            </p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        {assessment.results.length === 0 && (
          <div className="rounded-xl border dark:border-gray-800 bg-white dark:bg-gray-900 py-16 text-center shadow-sm">
            <ClipboardList className="mx-auto h-10 w-10 text-gray-200 dark:text-gray-700 mb-3" />
            <p className="text-sm text-gray-400 dark:text-gray-500">
              No findings recorded for this assessment.
            </p>
          </div>
        )}
      </main>
    </>
  );
}
