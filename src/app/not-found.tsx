import Link from "next/link";
import { Compass, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950 p-6">
      <div className="w-full max-w-md rounded-2xl border dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950">
          <Compass className="h-6 w-6 text-blue-500" />
        </div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Page not found</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          The page you&apos;re looking for doesn&apos;t exist or may have moved.
        </p>
        <div className="mt-6 flex justify-center">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Home className="h-4 w-4" /> Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
