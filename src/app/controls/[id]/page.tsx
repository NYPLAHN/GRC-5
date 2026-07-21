import Header from "@/components/layout/Header";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { enforcePermission } from "@/lib/rbac";
import { cn, formatControlStatus, getControlStatusClasses, formatDate, formatFileSize } from "@/lib/utils";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, ShieldCheck, Calendar, User } from "lucide-react";

async function getControl(id: string) {
  return prisma.internalControl.findUnique({
    where: { id },
    include: {
      frameworkMappings: {
        include: {
          requirement: {
            include: { framework: true },
          },
        },
        orderBy: { requirement: { controlId: "asc" } },
      },
      evidence: {
        include: { uploader: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
      },
      remediations: {
        include: { assignee: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

const FRAMEWORK_COLORS: Record<string, string> = {
  NIST_CSF_2: "bg-blue-50 border-blue-200 text-blue-800",
  CIS_V8_1: "bg-purple-50 border-purple-200 text-purple-800",
  PCI_DSS_4: "bg-cyan-50 border-cyan-200 text-cyan-800",
};

export default async function ControlDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireAuth();
  enforcePermission(user.role, "controls:read");

  const control = await getControl(params.id);
  if (!control) notFound();

  // Group mappings by framework
  const byFramework = new Map<string, typeof control.frameworkMappings>();
  control.frameworkMappings.forEach((m) => {
    const fw = m.requirement.framework.name;
    if (!byFramework.has(fw)) byFramework.set(fw, []);
    byFramework.get(fw)!.push(m);
  });

  return (
    <>
      <Header title={control.controlCode} subtitle={control.title} />
      <main className="grc-page space-y-6">
        <Link
          href="/controls"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Controls Library
        </Link>

        {/* Control header card */}
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="rounded-lg bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700">
                  {control.controlCode}
                </span>
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                    getControlStatusClasses(control.status)
                  )}
                >
                  {formatControlStatus(control.status)}
                </span>
              </div>
              <h2 className="text-xl font-bold text-gray-900">{control.title}</h2>
              <p className="mt-2 text-sm text-gray-600 max-w-3xl">{control.description}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <User className="h-4 w-4 text-gray-400" />
              <span><strong>Owner:</strong> {control.owner ?? "Unassigned"}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <ShieldCheck className="h-4 w-4 text-gray-400" />
              <span><strong>Category:</strong> {control.category ?? "—"}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span><strong>Updated:</strong> {formatDate(control.updatedAt)}</span>
            </div>
          </div>
        </div>

        {/* Framework mappings */}
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-gray-900">
            Framework Mappings ({control.frameworkMappings.length} requirements)
          </h3>
          <div className="space-y-4">
            {Array.from(byFramework.entries()).map(([fwName, mappings]) => {
              const slug = mappings[0]?.requirement.framework.slug ?? "";
              return (
                <div key={fwName}>
                  <div
                    className={cn(
                      "mb-2 inline-flex rounded-full border px-3 py-0.5 text-xs font-semibold",
                      FRAMEWORK_COLORS[slug] ?? "bg-gray-50 border-gray-200 text-gray-700"
                    )}
                  >
                    {fwName} v{mappings[0]?.requirement.framework.version}
                  </div>
                  <div className="space-y-2">
                    {mappings.map((m) => (
                      <div
                        key={m.id}
                        className="rounded-lg border bg-gray-50 p-3"
                      >
                        <div className="flex items-start gap-3">
                          <span className="flex-shrink-0 rounded bg-white border px-2 py-0.5 text-xs font-mono font-bold text-gray-600">
                            {m.requirement.controlId}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-gray-800">
                              {m.requirement.title}
                            </p>
                            <p className="mt-0.5 text-xs text-gray-500">
                              {m.requirement.subCategory}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {control.frameworkMappings.length === 0 && (
              <p className="text-sm text-gray-400">
                This control has not been mapped to any framework requirements yet.
              </p>
            )}
          </div>
        </div>

        {/* Evidence Locker for this control */}
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">
              Evidence History ({control.evidence.length} artifacts)
            </h3>
            <Link
              href={`/evidence?controlId=${control.id}`}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              Upload evidence →
            </Link>
          </div>
          {control.evidence.length === 0 ? (
            <p className="py-4 text-sm text-gray-400">
              No evidence uploaded for this control yet.
            </p>
          ) : (
            <div className="space-y-2">
              {control.evidence.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <FileText className="h-5 w-5 flex-shrink-0 text-gray-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{ev.title}</p>
                    <p className="text-xs text-gray-500">
                      {ev.fileName} · {formatFileSize(ev.fileSize)} · v{ev.version} · {formatDate(ev.createdAt)} ·{" "}
                      {ev.uploader.name ?? ev.uploader.email}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 bg-gray-100 rounded px-2 py-0.5">
                    {ev.fileType}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Open remediations */}
        {control.remediations.length > 0 && (
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-base font-semibold text-gray-900">
              Linked Remediations
            </h3>
            <div className="space-y-2">
              {control.remediations.map((rem) => (
                <div key={rem.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{rem.title}</p>
                    <p className="text-xs text-gray-500">
                      Assigned to {rem.assignee.name ?? rem.assignee.email} ·{" "}
                      {rem.status.replace("_", " ")}
                      {rem.jiraIssueKey && (
                        <a
                          href={rem.jiraIssueUrl ?? "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 font-medium text-blue-600"
                        >
                          {rem.jiraIssueKey}
                        </a>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
