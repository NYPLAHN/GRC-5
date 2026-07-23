import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { enforcePermission } from "@/lib/rbac";
import { z } from "zod";

const LIKELIHOOD_SCORES: Record<string, number> = {
  RARE: 1, UNLIKELY: 2, POSSIBLE: 3, LIKELY: 4, ALMOST_CERTAIN: 5,
};
const IMPACT_SCORES: Record<string, number> = {
  NEGLIGIBLE: 1, MINOR: 2, MODERATE: 3, MAJOR: 4, CRITICAL: 5,
};

const UpdateRiskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.string().optional().nullable(),
  owner: z.string().optional().nullable(),
  likelihood: z.enum(["RARE", "UNLIKELY", "POSSIBLE", "LIKELY", "ALMOST_CERTAIN"]).optional(),
  impact: z.enum(["NEGLIGIBLE", "MINOR", "MODERATE", "MAJOR", "CRITICAL"]).optional(),
  velocity: z.enum(["SLOW", "MEDIUM", "FAST"]).optional(),
  residualScore: z.number().min(1).max(25).optional(),
  treatment: z.enum(["MITIGATE", "TRANSFER", "ACCEPT", "AVOID"]).optional(),
  treatmentDetails: z.string().optional().nullable(),
  isOpen: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    enforcePermission(user.role, "risks:write");

    const body = await request.json();
    const validated = UpdateRiskSchema.parse(body);

    // Fetch current risk so we can recompute inherentScore if likelihood/impact changed
    const current = await prisma.risk.findUnique({
      where: { id: params.id },
      select: { likelihood: true, impact: true },
    });

    if (!current) {
      return NextResponse.json({ error: "Risk not found" }, { status: 404 });
    }

    const newLikelihood = validated.likelihood ?? current.likelihood;
    const newImpact = validated.impact ?? current.impact;
    const inherentScore =
      (LIKELIHOOD_SCORES[newLikelihood] ?? 3) *
      (IMPACT_SCORES[newImpact] ?? 3);

    const risk = await prisma.risk.update({
      where: { id: params.id },
      data: {
        ...validated,
        inherentScore,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "UPDATE_RISK",
        entityType: "Risk",
        entityId: risk.id,
        changes: validated,
      },
    });

    return NextResponse.json({ data: risk });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return NextResponse.json({ error: "Validation error", details: err.errors }, { status: 400 });
    }
    const status = err.message?.startsWith("Unauthorized") ? 401
      : err.message?.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    enforcePermission(user.role, "risks:read");

    const risk = await prisma.risk.findUnique({ where: { id: params.id } });

    if (!risk) {
      return NextResponse.json({ error: "Risk not found" }, { status: 404 });
    }

    return NextResponse.json({ data: risk });
  } catch (err: any) {
    const status = err.message?.startsWith("Unauthorized") ? 401
      : err.message?.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
