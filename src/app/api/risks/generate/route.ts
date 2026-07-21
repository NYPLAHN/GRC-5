import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { enforcePermission } from "@/lib/rbac";
import { z } from "zod";

const GenerateSchema = z.object({
  assessmentId: z.string().min(1),
});

function gapToRiskParams(status: string) {
  if (status === "NON_COMPLIANT") {
    return {
      likelihood: "LIKELY" as const,
      impact: "MAJOR" as const,
      velocity: "MEDIUM" as const,
      inherentScore: 16,
      residualScore: 10,
      treatment: "MITIGATE" as const,
    };
  }
  // PARTIAL
  return {
    likelihood: "POSSIBLE" as const,
    impact: "MODERATE" as const,
    velocity: "SLOW" as const,
    inherentScore: 9,
    residualScore: 5,
    treatment: "MITIGATE" as const,
  };
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforcePermission(user.role, "risks:write");

    const body = await request.json();
    const { assessmentId } = GenerateSchema.parse(body);

    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: {
        results: {
          where: { status: { in: ["NON_COMPLIANT", "PARTIAL"] } },
          include: {
            control: true,
            requirement: { include: { framework: true } },
          },
        },
      },
    });

    if (!assessment) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    if (assessment.results.length === 0) {
      return NextResponse.json({
        data: { created: 0, risks: [] },
        message: "No gaps found — all controls are compliant.",
      });
    }

    const lastRisk = await prisma.risk.findFirst({ orderBy: { riskId: "desc" } });
    let lastNum = lastRisk
      ? parseInt(lastRisk.riskId.replace("RISK-", ""), 10)
      : 0;

    const createdRisks = [];

    for (const result of assessment.results) {
      lastNum++;
      const riskId = `RISK-${String(lastNum).padStart(3, "0")}`;
      const params = gapToRiskParams(result.status);

      const frameworkRef = result.requirement
        ? ` [${result.requirement.framework.name} — ${result.requirement.controlId}]`
        : "";

      const risk = await prisma.risk.create({
        data: {
          riskId,
          title: `Compliance Gap: ${result.control.title}`,
          description:
            `Assessment "${assessment.title}" identified ${result.control.controlCode} as ${result.status}${frameworkRef}. ` +
            (result.notes ? result.notes : "No additional notes."),
          category: "Compliance",
          owner: result.control.owner ?? "Information Security",
          ...params,
          relatedControls: [result.control.controlCode],
          treatmentDetails:
            `Remediate compliance gap from ${assessment.title}. ` +
            `Control: ${result.control.controlCode} — ${result.control.title}. ` +
            `Assessment score: ${result.score ?? "N/A"}/100. ` +
            `Status: ${result.status}. Review control implementation and establish remediation plan.`,
        },
      });

      createdRisks.push(risk);
    }

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "GENERATE_RISKS_FROM_ASSESSMENT",
        entityType: "Risk",
        entityId: assessmentId,
        changes: { assessmentId, created: createdRisks.length },
      },
    });

    return NextResponse.json(
      { data: { created: createdRisks.length, risks: createdRisks } },
      { status: 201 }
    );
  } catch (err: any) {
    if (err.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation error", details: err.errors },
        { status: 400 }
      );
    }
    const status = err.message.startsWith("Unauthorized")
      ? 401
      : err.message.startsWith("Forbidden")
      ? 403
      : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
