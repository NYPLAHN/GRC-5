"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";

/**
 * Global error boundary — replaces Next.js's raw
 * "Application error: a server-side exception has occurred" screen
 * with a friendly, recoverable page.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Page error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950 p-6">
      <div className="w-full max-w-md rounded-2xl border dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-950">
          <AlertTriangle className="h-6 w-6 text-red-500" />
        </div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Something went wrong</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          This page hit an unexpected error. It&apos;s usually temporary — try again, or head back to the dashboard.
        </p>
        {error?.message && (
          <p className="mt-3 rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2 font-mono text-[11px] text-gray-500 dark:text-gray-400 break-words">
            {error.message.slice(0, 300)}
            {error.digest && <span className="block mt-1 text-gray-400">Ref: {error.digest}</span>}
          </p>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <RotateCcw className="h-4 w-4" /> Try Again
          </button>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-lg border dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <Home className="h-4 w-4" /> Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
