import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { enforcePermission } from "@/lib/rbac";
import { computeRiskScore } from "@/lib/utils";
import { z } from "zod";

const CreateRiskSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.string().optional(),
  owner: z.string().optional(),
  likelihood: z.enum(["RARE", "UNLIKELY", "POSSIBLE", "LIKELY", "ALMOST_CERTAIN"]),
  impact: z.enum(["NEGLIGIBLE", "MINOR", "MODERATE", "MAJOR", "CRITICAL"]),
  velocity: z.enum(["SLOW", "MEDIUM", "FAST"]),
  residualScore: z.number().int().min(1).max(25),
  treatment: z.enum(["MITIGATE", "TRANSFER", "ACCEPT", "AVOID"]),
  treatmentDetails: z.string().optional(),
  reviewDate: z.string().optional(),
  relatedControls: z.array(z.string()).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforcePermission(user.role, "risks:read");

    const { searchParams } = new URL(request.url);
    const treatment = searchParams.get("treatment");
    const minScore = searchParams.get("minScore");
    const isOpen = searchParams.get("isOpen");
    const search = searchParams.get("search");

    const where = {
      ...(treatment ? { treatment: treatment as any } : {}),
      ...(minScore ? { inherentScore: { gte: parseInt(minScore) } } : {}),
      ...(isOpen !== null ? { isOpen: isOpen === "true" } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" as const } },
              { riskId: { contains: search, mode: "insensitive" as const } },
              { category: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const risks = await prisma.risk.findMany({
      where,
      orderBy: [{ inherentScore: "desc" }, { riskId: "asc" }],
    });

    return NextResponse.json({ data: risks, total: risks.length });
  } catch (err: any) {
    const status = err.message.startsWith("Unauthorized") ? 401
      : err.message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforcePermission(user.role, "risks:write");

    const body = await request.json();
    const validated = CreateRiskSchema.parse(body);

    // Auto-compute inherent score from likelihood × impact
    const inherentScore = computeRiskScore(validated.likelihood, validated.impact);

    // Generate sequential risk ID
    const lastRisk = await prisma.risk.findFirst({ orderBy: { riskId: "desc" } });
    const lastNum = lastRisk
      ? parseInt(lastRisk.riskId.replace("RISK-", ""), 10)
      : 0;
    const riskId = `RISK-${String(lastNum + 1).padStart(3, "0")}`;

    const risk = await prisma.risk.create({
      data: {
        riskId,
        ...validated,
        inherentScore,
        relatedControls: validated.relatedControls ?? [],
        reviewDate: validated.reviewDate ? new Date(validated.reviewDate) : null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "CREATE_RISK",
        entityType: "Risk",
        entityId: risk.id,
        changes: { created: risk },
      },
    });

    return NextResponse.json({ data: risk }, { status: 201 });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return NextResponse.json({ error: "Validation error", details: err.errors }, { status: 400 });
    }
    const status = err.message.startsWith("Unauthorized") ? 401
      : err.message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
