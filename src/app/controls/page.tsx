import Header from "@/components/layout/Header";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { enforcePermission } from "@/lib/rbac";
import { cn, formatControlStatus, getControlStatusClasses } from "@/lib/utils";
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  XCircle,
  Minus,
  ChevronRight,
  Tag,
} from "lucide-react";
import Link from "next/link";

async function getControls() {
  return prisma.internalControl.findMany({
    include: {
      frameworkMappings: {
        include: { requirement: { include: { framework: true } } },
      },
      _count: { select: { evidence: true, remediations: true } },
    },
    orderBy: { controlCode: "asc" },
  });
}

const STATUS_ICONS = {
  IMPLEMENTED: CheckCircle2,
  IN_PROGRESS: Clock,
  NOT_STARTED: XCircle,
  NOT_APPLICABLE: Minus,
};

const FRAMEWORK_COLORS: Record<string, string> = {
  NIST_CSF_2: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  CIS_V8_1: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
  PCI_DSS_4: "bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-800",
  ISO_27001_2022: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
};

const FRAMEWORK_SHORT: Record<string, string> = {
  NIST_CSF_2: "NIST",
  CIS_V8_1: "CIS",
  PCI_DSS_4: "PCI",
  ISO_27001_2022: "ISO",
};

export default async function ControlsPage() {
  const user = await requireAuth();
  enforcePermission(user.role, "controls:read");
  const controls = await getControls();

  const statusCounts = {
    IMPLEMENTED: controls.filter((c) => c.status === "IMPLEMENTED").length,
    IN_PROGRESS: controls.filter((c) => c.status === "IN_PROGRESS").length,
    NOT_STARTED: controls.filter((c) => c.status === "NOT_STARTED").length,
    NOT_APPLICABLE: controls.filter((c) => c.status === "NOT_APPLICABLE").length,
  };

  const frameworkSet = new Set<string>();
  controls.forEach((c) => c.frameworkMappings.forEach((m) => frameworkSet.add(m.requirement.framework.slug)));
  const frameworks = Array.from(frameworkSet);

  return (
    <>
      <Header title="Controls Library" subtitle="Map once, comply to many frameworks" />
      <main className="grc-page space-y-6">
        {/* Status summary */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(["IMPLEMENTED", "IN_PROGRESS", "NOT_STARTED", "NOT_APPLICABLE"] as const).map((status) => {
            const Icon = STATUS_ICONS[status];
            return (
              <div key={status} className={cn("flex items-center gap-3 rounded-xl border p-4", getControlStatusClasses(status))}>
                <Icon className="h-5 w-5" />
                <div>
                  <p className="text-xl font-bold">{statusCounts[status]}</p>
                  <p className="text-xs">{formatControlStatus(status)}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Framework coverage note */}
        {frameworks.length > 0 && (
          <div className="rounded-xl border bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 dark:border-blue-900/50 p-4">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              <ShieldCheck className="mr-1.5 inline-block h-4 w-4 text-blue-600 dark:text-blue-400" />
              Cross-framework coverage active across{" "}
              <strong>{frameworks.length}</strong> frameworks:{" "}
              {frameworks.map((s) => FRAMEWORK_SHORT[s] ?? s).join(", ")}.
              Each internal control maps to all relevant framework requirements.
            </p>
          </div>
        )}

        {/* Controls Table */}
        <div className="overflow-hidden rounded-xl border dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <div className="border-b dark:border-gray-800 px-6 py-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Internal Controls ({controls.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Control</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Framework Mappings</th>
                  <th>Owner</th>
                  <th>Evidence</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {controls.map((control) => {
                  const Icon = STATUS_ICONS[control.status as keyof typeof STATUS_ICONS] ?? Minus;
                  const fwMap = new Map<string, { slug: string; ids: string[] }>();
                  control.frameworkMappings.forEach((m) => {
                    const slug = m.requirement.framework.slug;
                    if (!fwMap.has(slug)) fwMap.set(slug, { slug, ids: [] });
                    fwMap.get(slug)!.ids.push(m.requirement.controlId);
                  });

                  return (
                    <tr key={control.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer">
                      <td>
                        <div className="flex items-start gap-2">
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-gray-100 text-xs">{control.controlCode}</p>
                            <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300 font-medium">{control.title}</p>
                            {control.tags.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {control.tags.slice(0, 3).map((tag) => (
                                  <span key={tag} className="inline-flex items-center gap-0.5 rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                                    <Tag className="h-2.5 w-2.5" />
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="text-gray-500 dark:text-gray-400 text-xs">{control.category ?? "—"}</td>
                      <td>
                        <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", getControlStatusClasses(control.status))}>
                          <Icon className="h-3 w-3" />
                          {formatControlStatus(control.status)}
                        </span>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1.5">
                          {Array.from(fwMap.entries()).map(([slug, info]) => (
                            <span key={slug} className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold", FRAMEWORK_COLORS[slug] ?? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400")}>
                              {FRAMEWORK_SHORT[slug] ?? slug}
                              <span className="ml-1 font-normal opacity-70">×{info.ids.length}</span>
                            </span>
                          ))}
                          {fwMap.size === 0 && <span className="text-xs text-gray-400">Unmapped</span>}
                        </div>
                      </td>
                      <td className="text-sm text-gray-600 dark:text-gray-400">
                        {control.owner ?? <span className="text-gray-300 dark:text-gray-600">—</span>}
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-1 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-0.5 text-xs text-gray-500 dark:text-gray-400">
                          {control._count.evidence} artifact{control._count.evidence !== 1 ? "s" : ""}
                        </span>
                      </td>
                      <td>
                        <Link href={`/controls/${control.id}`} className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300">
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {controls.length === 0 && (
              <div className="py-16 text-center text-sm text-gray-400 dark:text-gray-500">
                No controls found. Run the database seed to load sample data.
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
