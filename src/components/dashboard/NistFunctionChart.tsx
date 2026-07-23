"use client";

import { cn } from "@/lib/utils";

interface FunctionData {
  function: string;
  compliant: number;
  partial: number;
  nonCompliant: number;
  total: number;
  score: number;
}

interface NistFunctionChartProps {
  data: FunctionData[];
}

const FUNCTION_META: Record<string, { abbr: string; color: string; fillColor: string; bgClass: string; textClass: string }> = {
  GOVERN: { abbr: "GV", color: "#9333ea", fillColor: "#a855f7", bgClass: "bg-purple-500", textClass: "text-purple-700 dark:text-purple-300" },
  IDENTIFY: { abbr: "ID", color: "#3b82f6", fillColor: "#60a5fa", bgClass: "bg-blue-500", textClass: "text-blue-700 dark:text-blue-300" },
  PROTECT: { abbr: "PR", color: "#22c55e", fillColor: "#4ade80", bgClass: "bg-green-500", textClass: "text-green-700 dark:text-green-300" },
  DETECT: { abbr: "DE", color: "#eab308", fillColor: "#facc15", bgClass: "bg-yellow-500", textClass: "text-yellow-700 dark:text-yellow-300" },
  RESPOND: { abbr: "RS", color: "#f97316", fillColor: "#fb923c", bgClass: "bg-orange-500", textClass: "text-orange-700 dark:text-orange-300" },
  RECOVER: { abbr: "RC", color: "#14b8a6", fillColor: "#2dd4bf", bgClass: "bg-teal-500", textClass: "text-teal-700 dark:text-teal-300" },
};

export default function NistFunctionChart({ data }: NistFunctionChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="chart-card">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Compliance by NIST Function</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">From most recent assessment</p>
        <div className="flex h-40 items-center justify-center text-sm text-gray-400 dark:text-gray-500">
          No assessment data yet. Upload an assessment to see results.
        </div>
      </div>
    );
  }

  return (
    <div className="chart-card">
      <div className="mb-5">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Compliance by NIST Function</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Latest assessment — compliant / partial / non-compliant per function</p>
      </div>

      <div className="space-y-3">
        {data.map((item) => {
          const meta = FUNCTION_META[item.function] ?? { abbr: item.function.slice(0, 2), color: "#6b7280", fillColor: "#9ca3af", bgClass: "bg-gray-500", textClass: "text-gray-600" };
          const compliantPct = item.total > 0 ? (item.compliant / item.total) * 100 : 0;
          const partialPct = item.total > 0 ? (item.partial / item.total) * 100 : 0;
          const nonCompliantPct = item.total > 0 ? (item.nonCompliant / item.total) * 100 : 0;
          const scoreColor =
            item.score >= 80 ? "text-green-600 dark:text-green-400"
              : item.score >= 60 ? "text-yellow-600 dark:text-yellow-400"
              : "text-red-600 dark:text-red-400";

          return (
            <div key={item.function}>
              <div className="flex items-center gap-3 mb-1">
                <span className={cn("flex h-6 w-8 flex-shrink-0 items-center justify-center rounded text-[10px] font-bold text-white", meta.bgClass)}>
                  {meta.abbr}
                </span>
                <span className={cn("text-xs font-semibold flex-1", meta.textClass)}>{item.function}</span>
                <span className={cn("text-xs font-bold ml-auto", scoreColor)}>{item.score}%</span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500 w-16 text-right">{item.total} reqs</span>
              </div>
              {/* Stacked bar */}
              <div className="flex h-3 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                {compliantPct > 0 && (
                  <div
                    className="bg-green-500 transition-all duration-700"
                    style={{ width: `${compliantPct}%` }}
                    title={`Compliant: ${item.compliant}`}
                  />
                )}
                {partialPct > 0 && (
                  <div
                    className="bg-yellow-400 transition-all duration-700"
                    style={{ width: `${partialPct}%` }}
                    title={`Partial: ${item.partial}`}
                  />
                )}
                {nonCompliantPct > 0 && (
                  <div
                    className="bg-red-400 transition-all duration-700"
                    style={{ width: `${nonCompliantPct}%` }}
                    title={`Non-Compliant: ${item.nonCompliant}`}
                  />
                )}
              </div>
              <div className="mt-1 flex gap-2 text-[10px] text-gray-400 dark:text-gray-500">
                {item.compliant > 0 && <span className="flex items-center gap-0.5"><span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />{item.compliant} compliant</span>}
                {item.partial > 0 && <span className="flex items-center gap-0.5"><span className="inline-block h-1.5 w-1.5 rounded-full bg-yellow-400" />{item.partial} partial</span>}
                {item.nonCompliant > 0 && <span className="flex items-center gap-0.5"><span className="inline-block h-1.5 w-1.5 rounded-full bg-red-400" />{item.nonCompliant} non-compliant</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-5 flex items-center gap-4 border-t dark:border-gray-800 pt-4">
        <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Legend</span>
        <span className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400"><span className="inline-block h-2 w-3 rounded-sm bg-green-500" />Compliant</span>
        <span className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400"><span className="inline-block h-2 w-3 rounded-sm bg-yellow-400" />Partial</span>
        <span className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400"><span className="inline-block h-2 w-3 rounded-sm bg-red-400" />Non-Compliant</span>
      </div>
    </div>
  );
}
