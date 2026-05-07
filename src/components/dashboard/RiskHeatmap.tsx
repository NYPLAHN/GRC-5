"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface HeatmapEntry {
  x: number; // likelihood 1-5
  y: number; // impact 1-5
  score: number;
  title: string;
  riskId: string;
  isOpen: boolean;
}

interface RiskHeatmapProps {
  data: HeatmapEntry[];
}

const LIKELIHOOD_LABELS = ["Rare", "Unlikely", "Possible", "Likely", "Almost\nCertain"];
const IMPACT_LABELS = ["Negligible", "Minor", "Moderate", "Major", "Critical"];

function getCellColor(likelihood: number, impact: number): string {
  const score = likelihood * impact;
  if (score >= 15) return "bg-red-500 hover:bg-red-600";
  if (score >= 10) return "bg-orange-400 hover:bg-orange-500";
  if (score >= 5) return "bg-yellow-300 hover:bg-yellow-400";
  return "bg-green-300 hover:bg-green-400";
}

function getCellTextColor(likelihood: number, impact: number): string {
  const score = likelihood * impact;
  if (score >= 10) return "text-white";
  return "text-gray-700";
}

export default function RiskHeatmap({ data }: RiskHeatmapProps) {
  const [tooltip, setTooltip] = useState<{ risks: HeatmapEntry[]; x: number; y: number } | null>(null);

  const getRisksAt = (x: number, y: number) =>
    data.filter((d) => d.x === x && d.y === y);

  return (
    <div className="chart-card">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Risk Heatmap</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Likelihood × Impact matrix</p>
      </div>

      <div className="overflow-x-auto">
        <div className="flex gap-2">
          {/* Y-axis label */}
          <div className="flex items-center">
            <span
              className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500"
              style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
            >
              Impact ↑
            </span>
          </div>

          <div>
            {/* Grid (impact top→bottom = 5→1) */}
            {[5, 4, 3, 2, 1].map((impact) => (
              <div key={impact} className="flex items-center gap-1.5 mb-1.5">
                {/* Row label */}
                <span className="w-20 text-right text-[10px] text-gray-500 dark:text-gray-400 pr-1">
                  {IMPACT_LABELS[impact - 1]}
                </span>
                {/* Cells */}
                {[1, 2, 3, 4, 5].map((likelihood) => {
                  const risksHere = getRisksAt(likelihood, impact);
                  const count = risksHere.length;
                  return (
                    <div
                      key={likelihood}
                      className={cn(
                        "relative flex h-12 w-14 cursor-pointer items-center justify-center rounded-md text-sm font-bold transition-all",
                        getCellColor(likelihood, impact),
                        getCellTextColor(likelihood, impact),
                        count > 0 ? "ring-2 ring-gray-700 dark:ring-gray-300 ring-offset-1 dark:ring-offset-gray-900" : "opacity-70"
                      )}
                      onMouseEnter={() =>
                        count > 0 && setTooltip({ risks: risksHere, x: likelihood, y: impact })
                      }
                      onMouseLeave={() => setTooltip(null)}
                    >
                      {count > 0 ? count : ""}
                      <span className="absolute bottom-1 right-1.5 text-[9px] opacity-60">
                        {likelihood * impact}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}

            {/* X-axis labels */}
            <div className="flex items-start gap-1.5 mt-2 ml-[88px]">
              {LIKELIHOOD_LABELS.map((label, i) => (
                <div key={i} className="w-14 text-center text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
                  {label}
                </div>
              ))}
            </div>
            <p className="mt-1 ml-[88px] text-center text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Likelihood →
            </p>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-3 border-t dark:border-gray-800 pt-3">
        {[
          { label: "Critical (≥15)", color: "bg-red-500" },
          { label: "High (10–14)", color: "bg-orange-400" },
          { label: "Medium (5–9)", color: "bg-yellow-300" },
          { label: "Low (1–4)", color: "bg-green-300" },
        ].map((item) => (
          <span key={item.label} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
            <span className={cn("h-3 w-3 rounded-sm", item.color)} />
            {item.label}
          </span>
        ))}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div className="mt-3 rounded-lg border dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3">
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Risks at Likelihood {LIKELIHOOD_LABELS[tooltip.x - 1]} × Impact {IMPACT_LABELS[tooltip.y - 1]}:
          </p>
          {tooltip.risks.map((r) => (
            <p key={r.riskId} className="text-xs text-gray-600 dark:text-gray-400">
              • <span className="font-medium">{r.riskId}</span>: {r.title}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
