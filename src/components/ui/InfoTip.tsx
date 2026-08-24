"use client";

import { Info } from "lucide-react";

/**
 * Small hover tooltip — wraps an info icon; shows `text` on hover/focus.
 * Pure CSS (group-hover), no portal needed.
 */
export default function InfoTip({ text, className }: { text: string; className?: string }) {
  return (
    <span className={`group relative inline-flex items-center ${className ?? ""}`}>
      <Info className="h-3.5 w-3.5 cursor-help text-gray-400 hover:text-blue-500" tabIndex={0} />
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 w-60 -translate-x-1/2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[11px] font-normal normal-case leading-snug tracking-normal text-gray-700 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
      >
        {text}
      </span>
    </span>
  );
}
