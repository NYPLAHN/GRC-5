import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { enforcePermission } from "@/lib/rbac";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    enforcePermission(user.role, "assessments:read");

    const assessment = await prisma.assessment.findUnique({
      where: { id: params.id },
      include: {
        conductor: { select: { id: true, name: true, version: true, slug: true } },
        results: {
          include: {
            control: { select: { id: true, controlCode: true, title: true, status: true } },
            requirement: {
              select: {
                id: true,
                controlId: true,
                category: true,
                subCategory: true,
                title: true,
                description: true,
              },
            },
          },
          orderBy: [{ requirement: { category: "asc" } }, { requirement: { controlId: "asc" } }],
        },
      },
    });

    if (!assessment) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    // Compute summary stats
    const total = assessment.results.length;
    const compliant = assessment.results.filter((r) => r.status === "COMPLIANT").length;
    const partial = assessment.results.filter((r) => r.status === "PARTIAL").length;
    const nonCompliant = assessment.results.filter((r) => r.status === "NON_COMPLIANT").length;
    const notApplicable = assessment.results.filter((r) => r.status === "NOT_APPLICABLE").length;
    const score = total > 0 ? Math.round(((compliant + partial * 0.5) / total) * 100) : 0;

    // Compute per-function stats
    const FUNCTIONS = ["GOVERN", "IDENTIFY", "PROTECT", "DETECT", "RESPOND", "RECOVER"];
    const functionStats = FUNCTIONS.map((fn) => {
      const fnResults = assessment.results.filter((r) => r.requirement?.category === fn);
      const fnTotal = fnResults.length;
      const fnCompliant = fnResults.filter((r) => r.status === "COMPLIANT").length;
      const fnPartial = fnResults.filter((r) => r.status === "PARTIAL").length;
      const fnNonCompliant = fnResults.filter((r) => r.status === "NON_COMPLIANT").length;
      const fnScore = fnTotal > 0 ? Math.round(((fnCompliant + fnPartial * 0.5) / fnTotal) * 100) : 0;
      return { function: fn, total: fnTotal, compliant: fnCompliant, partial: fnPartial, nonCompliant: fnNonCompliant, score: fnScore };
    }).filter((fn) => fn.total > 0);

    return NextResponse.json({
      data: {
        ...assessment,
        summary: { total, compliant, partial, nonCompliant, notApplicable, score },
        functionStats,
      },
    });
  } catch (err: any) {
    const status = err.message.startsWith("Unauthorized") ? 401
      : err.message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
