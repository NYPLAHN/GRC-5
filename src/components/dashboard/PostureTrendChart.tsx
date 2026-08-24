"use client";

import {
  ComposedChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend, CartesianGrid,
} from "recharts";
import { TrendingUp } from "lucide-react";

export type TrendPoint = {
  snapshotDate: string; // YYYY-MM-DD
  complianceScore: number | null;
  controlRiskScore: number | null;
  vendorRiskAvg: number | null;
  risksOpen: number;
  remediationsOverdue: number;
};

export default function PostureTrendChart({ data }: { data: TrendPoint[] }) {
  const points = data.map((d) => ({
    ...d,
    label: new Date(d.snapshotDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));

  return (
    <div className="rounded-xl border dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-gray-100">
            <TrendingUp className="h-4 w-4 text-blue-500" /> Posture Over Time
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Daily snapshots — captured automatically each time the dashboard loads on a new day
          </p>
        </div>
      </div>

      {points.length < 2 ? (
        <div className="flex flex-col items-center justify-center gap-1 py-10 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {points.length === 0 ? "First snapshot will be captured on next load." : "First snapshot captured today."}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Trends appear once there are snapshots on two or more days — check back tomorrow.
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={points} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="score" domain={[0, 100]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="count" orientation="right" allowDecimals={false} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
              formatter={(value: number, name: string) => {
                const scoreNames = ["Compliance %", "Control Risk", "Vendor Risk Avg"];
                return [scoreNames.includes(name) ? `${value}${name === "Compliance %" ? "%" : " / 100"}` : value, name];
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line yAxisId="score" type="monotone" dataKey="complianceScore" name="Compliance %" stroke="#16a34a" strokeWidth={2} dot={false} connectNulls />
            <Line yAxisId="score" type="monotone" dataKey="controlRiskScore" name="Control Risk" stroke="#dc2626" strokeWidth={2} dot={false} connectNulls />
            <Line yAxisId="score" type="monotone" dataKey="vendorRiskAvg" name="Vendor Risk Avg" stroke="#9333ea" strokeWidth={2} strokeDasharray="4 3" dot={false} connectNulls />
            <Line yAxisId="count" type="monotone" dataKey="risksOpen" name="Open Risks" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
            <Line yAxisId="count" type="monotone" dataKey="remediationsOverdue" name="Overdue Remediations" stroke="#64748b" strokeWidth={1.5} strokeDasharray="2 3" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
      <p className="mt-1 text-center text-[10px] text-gray-400 dark:text-gray-500">
        Left axis: scores (compliance higher is better; control/vendor risk lower is better) · Right axis: counts
      </p>
    </div>
  );
}
