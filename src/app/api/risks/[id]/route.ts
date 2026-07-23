import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { enforcePermission } from "@/lib/rbac";
import { computeRiskScore } from "@/lib/utils";
import { z } from "zod";

const UpdateRiskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  category: z.string().optional(),
  owner: z.string().optional(),
  likelihood: z.enum(["RARE", "UNLIKELY", "POSSIBLE", "LIKELY", "ALMOST_CERTAIN"]).optional(),
  impact: z.enum(["NEGLIGIBLE", "MINOR", "MODERATE", "MAJOR", "CRITICAL"]).optional(),
  velocity: z.enum(["SLOW", "MEDIUM", "FAST"]).optional(),
  residualScore: z.number().int().min(1).max(25).optional(),
  treatment: z.enum(["MITIGATE", "TRANSFER", "ACCEPT", "AVOID"]).optional(),
  treatmentDetails: z.string().optional(),
  isOpen: z.boolean().optional(),
  reviewDate: z.string().optional(),
});

export async function GET(
  _request: NextRequest,
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
    const status = err.message.startsWith("Unauthorized") ? 401
      : err.message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    enforcePermission(user.role, "risks:write");

    const body = await request.json();
    const validated = UpdateRiskSchema.parse(body);

    // Re-compute inherentScore if likelihood or impact changed
    let inherentScoreUpdate: { inherentScore: number } | object = {};
    if (validated.likelihood || validated.impact) {
      // Fetch current values to fill in whichever wasn't supplied
      const current = await prisma.risk.findUnique({
        where: { id: params.id },
        select: { likelihood: true, impact: true },
      });
      if (current) {
        const likelihood = validated.likelihood ?? current.likelihood;
        const impact = validated.impact ?? current.impact;
        inherentScoreUpdate = { inherentScore: computeRiskScore(likelihood, impact) };
      }
    }

    const risk = await prisma.risk.update({
      where: { id: params.id },
      data: {
        ...validated,
        ...inherentScoreUpdate,
        reviewDate: validated.reviewDate ? new Date(validated.reviewDate) : undefined,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "UPDATE_RISK",
        entityType: "Risk",
        entityId: risk.id,
        changes: { updated: validated },
      },
    });

    return NextResponse.json({ data: risk });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return NextResponse.json({ error: "Validation error", details: err.errors }, { status: 400 });
    }
    const status = err.message.startsWith("Unauthorized") ? 401
      : err.message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
