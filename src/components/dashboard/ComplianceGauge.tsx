"use client";

import { cn } from "@/lib/utils";

interface FrameworkCompliance {
  framework: string;
  slug: string;
  score: number;
  compliant: number;
  partial: number;
  nonCompliant: number;
  total: number;
}

interface ComplianceGaugeProps {
  frameworks: FrameworkCompliance[];
}

const FRAMEWORK_COLORS: Record<string, string> = {
  NIST_CSF_2: "#3b82f6",
  CIS_V8_1: "#8b5cf6",
  PCI_DSS_4: "#06b6d4",
  ISO_27001_2022: "#10b981",
};

function ScoreArc({ score, color, label }: { score: number; color: string; label: string }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const scoreColor =
    score >= 80 ? "#16a34a" : score >= 60 ? "#d97706" : score >= 40 ? "#ea580c" : "#dc2626";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <svg width="128" height="128" viewBox="0 0 128 128">
          {/* Background track — uses currentColor trick via a class */}
          <circle
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            className="stroke-gray-200 dark:stroke-gray-700"
            strokeWidth="12"
          />
          {/* Score arc */}
          <circle
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 64 64)"
            className="transition-all duration-700 ease-out"
          />
          {/* Score text */}
          <text
            x="64"
            y="60"
            textAnchor="middle"
            dominantBaseline="middle"
            fill={scoreColor}
            fontSize="22"
            fontWeight="700"
          >
            {score}%
          </text>
          <text
            x="64"
            y="80"
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#9ca3af"
            fontSize="10"
          >
            compliance
          </text>
        </svg>
      </div>
      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{label}</p>
    </div>
  );
}

export default function ComplianceGauge({ frameworks }: ComplianceGaugeProps) {
  return (
    <div className="chart-card">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Framework Compliance</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Latest assessment scores</p>
        </div>
      </div>

      {frameworks.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-gray-400 dark:text-gray-500">
          No assessment data yet. Run an assessment to see compliance scores.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap justify-around gap-6 py-4">
            {frameworks.map((fw) => (
              <ScoreArc
                key={fw.slug}
                score={fw.score}
                color={FRAMEWORK_COLORS[fw.slug] ?? "#6b7280"}
                label={fw.framework}
              />
            ))}
          </div>

          {/* Detail breakdown */}
          <div className="mt-4 space-y-3 border-t dark:border-gray-800 pt-4">
            {frameworks.map((fw) => (
              <div key={fw.slug}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-gray-700 dark:text-gray-300">{fw.framework}</span>
                  <span className="text-gray-500 dark:text-gray-400">
                    {fw.compliant}/{fw.total} controls
                  </span>
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div
                    className="bg-green-500 transition-all"
                    style={{ width: `${(fw.compliant / fw.total) * 100}%` }}
                  />
                  <div
                    className="bg-yellow-400 transition-all"
                    style={{ width: `${(fw.partial / fw.total) * 100}%` }}
                  />
                  <div
                    className="bg-red-400 transition-all"
                    style={{ width: `${(fw.nonCompliant / fw.total) * 100}%` }}
                  />
                </div>
                <div className="mt-1 flex gap-3 text-[10px] text-gray-400 dark:text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                    Compliant: {fw.compliant}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-yellow-400" />
                    Partial: {fw.partial}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-400" />
                    Non-Compliant: {fw.nonCompliant}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
