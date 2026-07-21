import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { enforcePermission } from "@/lib/rbac";
import { createJiraIssue } from "@/lib/jira";
import { z } from "zod";

const CreateRemediationSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  controlId: z.string().min(1),
  assignedTo: z.string().min(1), // Prisma user ID
  priority: z.number().int().min(1).max(4).default(2),
  dueDate: z.string().optional(),
  createJiraIssue: z.boolean().optional().default(false),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforcePermission(user.role, "remediation:read");

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const controlId = searchParams.get("controlId");
    const assignedTo = searchParams.get("assignedTo");

    const remediations = await prisma.remediation.findMany({
      where: {
        ...(status ? { status: status as any } : {}),
        ...(controlId ? { controlId } : {}),
        ...(assignedTo ? { assignedTo } : {}),
      },
      include: {
        control: { select: { controlCode: true, title: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ data: remediations, total: remediations.length });
  } catch (err: any) {
    const status = err.message.startsWith("Unauthorized") ? 401
      : err.message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforcePermission(user.role, "remediation:write");

    const body = await request.json();
    const validated = CreateRemediationSchema.parse(body);
    const { createJiraIssue: shouldCreateJira, ...remediationData } = validated;

    // Verify the control exists
    const control = await prisma.internalControl.findUnique({
      where: { id: remediationData.controlId },
      select: { controlCode: true, title: true },
    });
    if (!control) {
      return NextResponse.json({ error: "Control not found" }, { status: 404 });
    }

    // Create remediation in DB
    const remediation = await prisma.remediation.create({
      data: {
        ...remediationData,
        dueDate: remediationData.dueDate ? new Date(remediationData.dueDate) : null,
      },
      include: {
        control: { select: { controlCode: true, title: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
    });

    // Optionally fire Jira webhook
    if (shouldCreateJira) {
      try {
        enforcePermission(user.role, "integrations:jira");
        const jiraIssue = await createJiraIssue({
          remediationId: remediation.id,
          title: remediation.title,
          description: remediation.description,
          controlCode: control.controlCode,
          priority: remediation.priority,
          dueDate: remediationData.dueDate,
        });

        // Update remediation with Jira reference
        await prisma.remediation.update({
          where: { id: remediation.id },
          data: {
            jiraIssueKey: jiraIssue.key,
            jiraIssueUrl: `${process.env.JIRA_BASE_URL}/browse/${jiraIssue.key}`,
            jiraSyncedAt: new Date(),
          },
        });

        remediation.jiraIssueKey = jiraIssue.key;
        remediation.jiraIssueUrl = `${process.env.JIRA_BASE_URL}/browse/${jiraIssue.key}`;
      } catch (jiraErr: any) {
        // Don't fail the whole request if Jira is unavailable
        console.error("Jira integration error:", jiraErr.message);
      }
    }

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "CREATE_REMEDIATION",
        entityType: "Remediation",
        entityId: remediation.id,
        changes: {
          title: remediation.title,
          controlId: remediation.controlId,
          jiraIssueKey: remediation.jiraIssueKey,
        },
      },
    });

    return NextResponse.json({ data: remediation }, { status: 201 });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return NextResponse.json({ error: "Validation error", details: err.errors }, { status: 400 });
    }
    const status = err.message.startsWith("Unauthorized") ? 401
      : err.message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
