"use client";

import { cn } from "@/lib/utils";

interface FunctionData {
  function: string;
  score: number;
}

interface NistRadarChartProps {
  data: FunctionData[];
}

const FUNCTION_ORDER = ["GOVERN", "IDENTIFY", "PROTECT", "DETECT", "RESPOND", "RECOVER"];
const FUNCTION_ABBR: Record<string, string> = {
  GOVERN: "GV", IDENTIFY: "ID", PROTECT: "PR", DETECT: "DE", RESPOND: "RS", RECOVER: "RC",
};
const FUNCTION_COLOR: Record<string, string> = {
  GOVERN: "#9333ea", IDENTIFY: "#3b82f6", PROTECT: "#22c55e",
  DETECT: "#eab308", RESPOND: "#f97316", RECOVER: "#14b8a6",
};

function polarToXY(angleDeg: number, radius: number, cx: number, cy: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

export default function NistRadarChart({ data }: NistRadarChartProps) {
  const cx = 140;
  const cy = 140;
  const maxR = 100;
  const levels = 4; // 25%, 50%, 75%, 100%

  // Fill gaps with 0 for missing functions
  const scoreMap: Record<string, number> = {};
  data.forEach((d) => { scoreMap[d.function] = d.score; });

  const functions = FUNCTION_ORDER.filter((f) => f in scoreMap || data.length > 0);
  const n = functions.length || 6;
  const angleStep = 360 / n;

  // Build polygon points for actual data
  const dataPoints = functions.map((fn, i) => {
    const score = scoreMap[fn] ?? 0;
    const r = (score / 100) * maxR;
    return polarToXY(i * angleStep, r, cx, cy);
  });
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") + " Z";

  // Grid rings
  const gridRings = Array.from({ length: levels }, (_, i) => {
    const r = ((i + 1) / levels) * maxR;
    const points = functions.map((_, j) => polarToXY(j * angleStep, r, cx, cy));
    return points.map((p, j) => `${j === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") + " Z";
  });

  if (data.length === 0) {
    return (
      <div className="chart-card">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">NIST CSF Maturity Radar</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Compliance score per function</p>
        <div className="flex h-64 items-center justify-center text-sm text-gray-400 dark:text-gray-500">
          No assessment data yet. Upload an assessment to see results.
        </div>
      </div>
    );
  }

  return (
    <div className="chart-card">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">NIST CSF Maturity Radar</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Compliance score per function — latest assessment</p>
      </div>

      <div className="flex flex-col items-center">
        <svg viewBox="0 0 280 280" className="w-full max-w-[260px]">
          {/* Grid rings */}
          {gridRings.map((path, i) => (
            <path
              key={i}
              d={path}
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
              className="text-gray-200 dark:text-gray-700"
            />
          ))}

          {/* Axis lines */}
          {functions.map((_, i) => {
            const outer = polarToXY(i * angleStep, maxR, cx, cy);
            return (
              <line
                key={i}
                x1={cx} y1={cy}
                x2={outer.x.toFixed(1)} y2={outer.y.toFixed(1)}
                stroke="currentColor"
                strokeWidth="0.5"
                className="text-gray-200 dark:text-gray-700"
              />
            );
          })}

          {/* Grid labels (25/50/75/100%) */}
          {[25, 50, 75, 100].map((pct) => {
            const r = (pct / 100) * maxR;
            const p = polarToXY(0, r, cx, cy);
            return (
              <text
                key={pct}
                x={p.x + 3}
                y={p.y}
                fontSize="7"
                fill="currentColor"
                className="text-gray-400 dark:text-gray-600"
                dominantBaseline="middle"
              >
                {pct}
              </text>
            );
          })}

          {/* Data polygon */}
          <path d={dataPath} fill="#3b82f620" stroke="#3b82f6" strokeWidth="2" />

          {/* Data dots */}
          {dataPoints.map((p, i) => {
            const fn = functions[i];
            return (
              <circle
                key={i}
                cx={p.x.toFixed(1)}
                cy={p.y.toFixed(1)}
                r="4"
                fill={FUNCTION_COLOR[fn] ?? "#6b7280"}
                stroke="white"
                strokeWidth="1.5"
              />
            );
          })}

          {/* Axis labels */}
          {functions.map((fn, i) => {
            const labelR = maxR + 18;
            const p = polarToXY(i * angleStep, labelR, cx, cy);
            const score = scoreMap[fn] ?? 0;
            return (
              <g key={fn}>
                <text
                  x={p.x.toFixed(1)}
                  y={(p.y - 5).toFixed(1)}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="700"
                  fill={FUNCTION_COLOR[fn] ?? "#6b7280"}
                >
                  {FUNCTION_ABBR[fn] ?? fn}
                </text>
                <text
                  x={p.x.toFixed(1)}
                  y={(p.y + 6).toFixed(1)}
                  textAnchor="middle"
                  fontSize="8"
                  fill="currentColor"
                  className="text-gray-500 dark:text-gray-400"
                >
                  {score}%
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Score pills */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {functions.map((fn) => {
          const score = scoreMap[fn] ?? 0;
          const scoreColor = score >= 80 ? "text-green-600 dark:text-green-400" : score >= 60 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400";
          return (
            <div
              key={fn}
              className="flex items-center gap-2 rounded-lg border dark:border-gray-700 px-2 py-1.5"
            >
              <span
                className="h-2 w-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: FUNCTION_COLOR[fn] ?? "#6b7280" }}
              />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 truncate">{FUNCTION_ABBR[fn]}</p>
                <p className={cn("text-xs font-bold", scoreColor)}>{score}%</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
