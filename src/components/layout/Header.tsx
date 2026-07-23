"use client";

import { UserButton } from "@clerk/nextjs";
import { Bell, Search, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch by only rendering after mount
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-lg" />
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

export default function Header({ title, subtitle }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-white dark:bg-gray-900 dark:border-gray-800 px-6 shadow-sm">
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h1>
        {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {/* Search trigger (future enhancement) */}
        <button className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors">
          <Search className="h-4 w-4" />
        </button>

        {/* Notification bell */}
        <button className="relative flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-900" />
        </button>

        {/* Dark/light mode toggle */}
        <ThemeToggle />

        {/* Clerk user button */}
        <UserButton
          afterSignOutUrl="/sign-in"
          appearance={{
            elements: {
              avatarBox: "h-8 w-8",
            },
          }}
        />
      </div>
    </header>
  );
}
