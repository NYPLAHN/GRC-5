"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ShieldCheck,
  AlertTriangle,
  ClipboardList,
  FolderLock,
  Wrench,
  BarChart3,
  Users,
  Settings,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

const navItems = [
  {
    section: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    section: "Risk & Compliance",
    items: [
      { href: "/controls", label: "Controls Library", icon: ShieldCheck },
      { href: "/risks", label: "Risk Register", icon: AlertTriangle },
      { href: "/assessments", label: "Assessments", icon: ClipboardList },
    ],
  },
  {
    section: "Operations",
    items: [
      { href: "/evidence", label: "Evidence Locker", icon: FolderLock },
      { href: "/remediation", label: "Remediation", icon: Wrench },
    ],
  },
  {
    section: "Reporting",
    items: [
      { href: "/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    section: "Administration",
    items: [
      { href: "/admin/users", label: "Users & Roles", icon: Users },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="grc-sidebar">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b dark:border-gray-800 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
          <ShieldCheck className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight">GRC Platform</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">v1.0 · Single Tenant</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {navItems.map((section) => (
          <div key={section.section} className="mb-4">
            <p className="mb-1 px-5 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-600">
              {section.section}
            </p>
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg mx-2 px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 flex-shrink-0",
                      isActive
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-300"
                    )}
                  />
                  <span className="flex-1">{item.label}</span>
                  {isActive && (
                    <ChevronRight className="h-3 w-3 text-blue-400 dark:text-blue-500" />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer links */}
      <div className="border-t dark:border-gray-800 p-4 space-y-1">
        <a
          href="https://www.nist.gov/cyberframework"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 dark:text-gray-600 dark:hover:text-gray-400 transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          NIST CSF 2.0 Reference
        </a>
        <a
          href="https://www.cisecurity.org/controls"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 dark:text-gray-600 dark:hover:text-gray-400 transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          CIS Controls v8.1 Reference
        </a>
      </div>
    </aside>
  );
}
