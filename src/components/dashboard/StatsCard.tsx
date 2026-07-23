"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  className?: string;
  href?: string; // optional link — wraps the whole card
}

export default function StatsCard({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  icon: Icon,
  iconColor = "text-blue-600",
  iconBg = "bg-blue-50",
  className,
  href,
}: StatsCardProps) {
  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor =
    trend === "up"
      ? "text-green-600 dark:text-green-400"
      : trend === "down"
      ? "text-red-600 dark:text-red-400"
      : "text-gray-400 dark:text-gray-500";

  const inner = (
    <div
      className={cn(
        "rounded-xl border bg-white dark:bg-gray-900 dark:border-gray-800 p-6 shadow-sm transition-shadow",
        href && "hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800 cursor-pointer",
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
            <div
              className={cn(
                "mt-2 flex items-center gap-1 text-xs font-medium",
                trendColor
              )}
            >
              <TrendIcon className="h-3.5 w-3.5" />
              {trendValue}
            </div>
          )}
        </div>
        <div className={cn("rounded-lg p-3", iconBg)}>
          <Icon className={cn("h-5 w-5", iconColor)} />
        </div>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{inner}</Link>;
  }

  return inner;
}
