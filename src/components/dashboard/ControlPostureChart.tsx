"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { cn, getMaturityColor, MATURITY_LABELS, getCriticalityClasses } from "@/lib/utils";

type ControlPosture = {
  controlCode: string;
  title: string;
  criticality: string;
  maturityLevel: number;
  riskScore: number; // 0–100
};

export default function ControlPostureChart({
  controls,
  overallScore,
}: {
  controls: ControlPosture[];
  overallScore: number; // 0–100, higher = riskier
}) {
  // Maturity distribution 0–5
  const distribution = [0, 1, 2, 3, 4, 5].map((level) => ({
    level: `L${level}`,
    label: MATURITY_LABELS[level],
    count: controls.filter((c) => c.maturityLevel === level).length,
    fill: getMaturityColor(level),
  }));

  const topRisky = [...controls].sort((a, b) => b.riskScore - a.riskScore).slice(0, 5);

  const scoreColor =
    overallScore >= 60 ? "text-red-600 dark:text-red-400"
    : overallScore >= 40 ? "text-orange-600 dark:text-orange-400"
    : overallScore >= 20 ? "text-yellow-600 dark:text-yellow-400"
    : "text-green-600 dark:text-green-400";

  const scoreRing =
    overallScore >= 60 ? "#dc2626"
    : overallScore >= 40 ? "#ea580c"
    : overallScore >= 20 ? "#d97706"
    : "#16a34a";

  const scoreLabel =
    overallScore >= 60 ? "High Risk"
    : overallScore >= 40 ? "Elevated"
    : overallScore >= 20 ? "Moderate"
    : "Healthy";

  // SVG donut gauge
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const dash = (overallScore / 100) * circumference;

  return (
    <div className="rounded-xl border dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Control Risk Posture</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Overall risk score from each control&apos;s criticality × maturity gap
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Gauge */}
        <div className="flex flex-col items-center justify-center">
          <div className="relative h-36 w-36">
            <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
              <circle cx="70" cy="70" r={radius} fill="none" strokeWidth="12" className="stroke-gray-100 dark:stroke-gray-800" />
              <circle
                cx="70" cy="70" r={radius} fill="none" strokeWidth="12"
                stroke={scoreRing} strokeLinecap="round"
                strokeDasharray={`${dash} ${circumference - dash}`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn("text-3xl font-bold", scoreColor)}>{overallScore}</span>
              <span className="text-[10px] text-gray-400 dark:text-gray-500">/ 100</span>
            </div>
          </div>
          <p className={cn("mt-2 text-sm font-semibold", scoreColor)}>{scoreLabel}</p>
          <p className="text-[10px] text-gray-400 dark:text-gray-500">Lower is better</p>
        </div>

        {/* Maturity distribution */}
        <div>
          <p className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-300">Maturity Distribution</p>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={distribution} margin={{ top: 16, right: 4, left: 4, bottom: 0 }}>
              <XAxis dataKey="level" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                cursor={{ fill: "rgba(0,0,0,0.04)" }}
                formatter={(value: number) => [`${value} controls`, ""]}
                labelFormatter={(label: string) => {
                  const lvl = parseInt(label.replace("L", ""), 10);
                  return `Level ${lvl} – ${MATURITY_LABELS[lvl]}`;
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="count" position="top" style={{ fontSize: 10, fill: "#9ca3af" }} />
                {distribution.map((d) => (
                  <Cell key={d.level} fill={d.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-center text-[10px] text-gray-400 dark:text-gray-500">
            L0 Not Performed → L5 Optimizing
          </p>
        </div>

        {/* Riskiest controls */}
        <div>
          <p className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-300">Highest-Risk Controls</p>
          <div className="space-y-1.5">
            {topRisky.map((c) => (
              <div key={c.controlCode} className="flex items-center gap-2">
                <span className="w-14 flex-shrink-0 font-mono text-[10px] font-bold text-gray-500 dark:text-gray-400">{c.controlCode}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${c.riskScore}%`,
                      backgroundColor: c.riskScore >= 60 ? "#dc2626" : c.riskScore >= 40 ? "#ea580c" : c.riskScore >= 20 ? "#d97706" : "#16a34a",
                    }}
                  />
                </div>
                <span className={cn("flex-shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold", getCriticalityClasses(c.criticality))}>
                  {c.criticality.charAt(0)}
                </span>
                <span className="w-6 flex-shrink-0 text-right text-[10px] font-bold text-gray-600 dark:text-gray-400">{c.riskScore}</span>
              </div>
            ))}
            {topRisky.length === 0 && (
              <p className="py-4 text-center text-xs text-gray-400 dark:text-gray-500">No controls yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
