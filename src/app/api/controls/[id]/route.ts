import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { enforcePermission } from "@/lib/rbac";
import { z } from "zod";

const UpdateControlSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(["IMPLEMENTED", "IN_PROGRESS", "NOT_STARTED", "NOT_APPLICABLE"]).optional(),
  owner: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  // Pass the full desired set of FrameworkRequirement UUIDs (replace-style)
  frameworkRequirementIds: z.array(z.string()).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    enforcePermission(user.role, "controls:write");

    const body = await request.json();
    const { frameworkRequirementIds, ...rest } = UpdateControlSchema.parse(body);

    // Build the Prisma update data
    const updateData: any = { ...rest };

    // If framework mapping IDs were supplied, replace all mappings atomically
    if (frameworkRequirementIds !== undefined) {
      updateData.frameworkMappings = {
        deleteMany: {},
        create: frameworkRequirementIds.map((reqId) => ({ requirementId: reqId })),
      };
    }

    const control = await prisma.internalControl.update({
      where: { id: params.id },
      data: updateData,
      include: {
        frameworkMappings: {
          include: { requirement: { include: { framework: true } } },
        },
        _count: { select: { evidence: true, remediations: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "UPDATE_CONTROL",
        entityType: "InternalControl",
        entityId: control.id,
        changes: { ...rest, frameworkRequirementIds },
      },
    });

    return NextResponse.json({ data: control });
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
    enforcePermission(user.role, "controls:read");

    const control = await prisma.internalControl.findUnique({
      where: { id: params.id },
      include: {
        frameworkMappings: {
          include: { requirement: { include: { framework: true } } },
        },
        _count: { select: { evidence: true, remediations: true } },
      },
    });

    if (!control) {
      return NextResponse.json({ error: "Control not found" }, { status: 404 });
    }

    return NextResponse.json({ data: control });
  } catch (err: any) {
    const status = err.message?.startsWith("Unauthorized") ? 401
      : err.message?.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
