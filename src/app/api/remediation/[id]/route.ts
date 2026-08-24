import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { enforcePermission } from "@/lib/rbac";
import { z } from "zod";

const UpdateRemediationSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  controlId: z.string().nullable().optional(),
  riskId: z.string().nullable().optional(),
  assignedTo: z.string().min(1).optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "WONT_FIX"]).optional(),
  priority: z.number().int().min(1).max(4).optional(),
  complexity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).nullable().optional(),
  dueDate: z.string().nullable().optional(),
  jiraIssueKey: z.string().nullable().optional(),
  jiraIssueUrl: z.string().nullable().optional(),
  jiraEpicKey: z.string().nullable().optional(),
  jiraEpicUrl: z.string().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    enforcePermission(user.role, "remediation:write");

    const body = await request.json();
    const validated = UpdateRemediationSchema.parse(body);

    // Auto-stamp resolvedAt when resolving; clear it when reopening
    const resolvedAtUpdate =
      validated.status === "RESOLVED"
        ? { resolvedAt: new Date() }
        : validated.status
        ? { resolvedAt: null }
        : {};

    const remediation = await prisma.remediation.update({
      where: { id: params.id },
      data: {
        ...validated,
        controlId: validated.controlId === "" ? null : validated.controlId,
        riskId: validated.riskId === "" ? null : validated.riskId,
        dueDate:
          validated.dueDate === null ? null
          : validated.dueDate ? new Date(validated.dueDate)
          : undefined,
        ...resolvedAtUpdate,
      },
      include: {
        control: { select: { controlCode: true, title: true } },
        risk: { select: { riskId: true, title: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "UPDATE_REMEDIATION",
        entityType: "Remediation",
        entityId: remediation.id,
        changes: { updated: validated },
      },
    });

    return NextResponse.json({ data: remediation });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return NextResponse.json({ error: "Validation error", details: err.errors }, { status: 400 });
    }
    const status = err.message.startsWith("Unauthorized") ? 401
      : err.message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
