import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { enforcePermission } from "@/lib/rbac";
import { z } from "zod";

const UpdateControlSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "IMPLEMENTED", "NOT_APPLICABLE"]).optional(),
  owner: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  frameworkRequirementIds: z.array(z.string()).optional(),
});

export async function GET(
  _request: NextRequest,
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
    enforcePermission(user.role, "controls:write");

    const body = await request.json();
    const validated = UpdateControlSchema.parse(body);
    const { frameworkRequirementIds, ...controlData } = validated;

    // If framework mappings supplied, replace them entirely
    const mappingOps =
      frameworkRequirementIds !== undefined
        ? {
            frameworkMappings: {
              deleteMany: {},
              create: frameworkRequirementIds.map((reqId) => ({
                requirementId: reqId,
              })),
            },
          }
        : {};

    const control = await prisma.internalControl.update({
      where: { id: params.id },
      data: { ...controlData, ...mappingOps },
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
        changes: { updated: controlData },
      },
    });

    return NextResponse.json({ data: control });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return NextResponse.json({ error: "Validation error", details: err.errors }, { status: 400 });
    }
    const status = err.message.startsWith("Unauthorized") ? 401
      : err.message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
