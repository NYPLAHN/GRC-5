"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  // Pre-rendered icon element (e.g. <AlertTriangle className="h-5 w-5 text-red-600" />).
  // Must be a ReactNode, NOT a component reference, so it can be serialized across
  // the Server → Client Component boundary.
  icon: ReactNode;
  iconBg?: string;
  className?: string;
}

export default function StatsCard({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  icon,
  iconBg = "bg-blue-50",
  className,
}: StatsCardProps) {
  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor =
    trend === "up" ? "text-green-600" : trend === "down" ? "text-red-600" : "text-gray-400";

  return (
    <div
      className={cn(
        "rounded-xl border bg-white dark:bg-gray-900 dark:border-gray-800 p-6 shadow-sm transition-shadow hover:shadow-md",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
          {subtitle && (
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{subtitle}</p>
          )}
          {trend && trendValue && (
            <div className={cn("mt-2 flex items-center gap-1 text-xs font-medium", trendColor)}>
              <TrendIcon className="h-3.5 w-3.5" />
              {trendValue}
            </div>
          )}
        </div>
        <div className={cn("rounded-lg p-3", iconBg)}>
          {icon}
        </div>
      </div>
    </div>
  );
}
