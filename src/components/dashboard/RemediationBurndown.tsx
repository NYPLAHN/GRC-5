"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface BurndownEntry {
  week: string;
  open: number;
  resolved: number;
}

interface RemediationBurndownProps {
  data: BurndownEntry[];
  total: number;
  open: number;
  resolved: number;
  overdue: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 shadow-lg text-xs">
      <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1.5">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.name} style={{ color: entry.color }} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          {entry.name === "open" ? "Open" : "Resolved"}: {entry.value}
        </p>
      ))}
    </div>
  );
};

export default function RemediationBurndown({
  data,
  total,
  open,
  resolved,
  overdue,
}: RemediationBurndownProps) {
  return (
    <div className="chart-card">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Remediation Burn-down</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Last 12 weeks</p>
        </div>
        <div className="flex gap-4 text-xs">
          <span className="flex items-center gap-1.5 font-medium text-gray-600 dark:text-gray-400">
            <span className="h-2 w-2 rounded-full bg-orange-400" />
            Open: {open}
          </span>
          <span className="flex items-center gap-1.5 font-medium text-gray-600 dark:text-gray-400">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            Resolved: {resolved}
          </span>
          {overdue > 0 && (
            <span className="flex items-center gap-1.5 font-medium text-red-600 dark:text-red-400">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              Overdue: {overdue}
            </span>
          )}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-gray-400 dark:text-gray-500">
          No remediation data yet.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="openGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f97316" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="resolvedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(156,163,175,0.2)" />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="open"
              stroke="#f97316"
              strokeWidth={2}
              fill="url(#openGrad)"
              name="open"
            />
            <Area
              type="monotone"
              dataKey="resolved"
              stroke="#22c55e"
              strokeWidth={2}
              fill="url(#resolvedGrad)"
              name="resolved"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
