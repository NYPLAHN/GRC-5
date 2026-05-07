import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { enforcePermission } from "@/lib/rbac";
import { z } from "zod";

const CreateAssessmentSchema = z.object({
  title: z.string().min(1),
  frameworkId: z.string().min(1),
  startDate: z.string(),
  endDate: z.string().optional(),
  notes: z.string().optional(),
  // Bulk results can be included at creation time
  results: z
    .array(
      z.object({
        controlId: z.string(),
        requirementId: z.string(),
        status: z.enum(["COMPLIANT", "PARTIAL", "NON_COMPLIANT", "NOT_APPLICABLE"]),
        score: z.number().int().min(0).max(100).optional(),
        notes: z.string().optional(),
      })
    )
    .optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforcePermission(user.role, "assessments:read");

    const { searchParams } = new URL(request.url);
    const frameworkId = searchParams.get("frameworkId");

    const assessments = await prisma.assessment.findMany({
      where: frameworkId ? { frameworkId } : {},
      include: {
        conductor: true,
        _count: { select: { results: true } },
        results: {
          select: { status: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Compute compliance summary per assessment
    const enriched = assessments.map((a) => {
      const total = a.results.length;
      const compliant = a.results.filter((r) => r.status === "COMPLIANT").length;
      const partial = a.results.filter((r) => r.status === "PARTIAL").length;
      const nonCompliant = a.results.filter((r) => r.status === "NON_COMPLIANT").length;
      const score = total > 0
        ? Math.round(((compliant + partial * 0.5) / total) * 100)
        : 0;
      return { ...a, summary: { total, compliant, partial, nonCompliant, score } };
    });

    return NextResponse.json({ data: enriched });
  } catch (err: any) {
    const status = err.message.startsWith("Unauthorized") ? 401
      : err.message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforcePermission(user.role, "assessments:write");

    const body = await request.json();
    const validated = CreateAssessmentSchema.parse(body);
    const { results, ...assessmentData } = validated;

    const assessment = await prisma.assessment.create({
      data: {
        ...assessmentData,
        conductedBy: user.id,
        startDate: new Date(assessmentData.startDate),
        endDate: assessmentData.endDate ? new Date(assessmentData.endDate) : null,
        ...(results?.length
          ? {
              results: {
                create: results.map((r) => ({
                  ...r,
                  score: r.score ?? null,
                })),
              },
            }
          : {}),
      },
      include: {
        conductor: true,
        results: true,
        _count: { select: { results: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "CREATE_ASSESSMENT",
        entityType: "Assessment",
        entityId: assessment.id,
        changes: { title: assessment.title, resultsCount: results?.length ?? 0 },
      },
    });

    return NextResponse.json({ data: assessment }, { status: 201 });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return NextResponse.json({ error: "Validation error", details: err.errors }, { status: 400 });
    }
    const status = err.message.startsWith("Unauthorized") ? 401
      : err.message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
