import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { enforcePermission } from "@/lib/rbac";
import { z } from "zod";

const CreateControlSchema = z.object({
  controlCode: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "IMPLEMENTED", "NOT_APPLICABLE"]).optional(),
  owner: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  frameworkRequirementIds: z.array(z.string()).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforcePermission(user.role, "controls:read");

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") ?? "1");
    const pageSize = parseInt(searchParams.get("pageSize") ?? "25");

    const where = {
      ...(category ? { category } : {}),
      ...(status ? { status: status as any } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" as const } },
              { controlCode: { contains: search, mode: "insensitive" as const } },
              { description: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [controls, total] = await Promise.all([
      prisma.internalControl.findMany({
        where,
        include: {
          frameworkMappings: {
            include: {
              requirement: {
                include: { framework: true },
              },
            },
          },
          _count: {
            select: { evidence: true, remediations: true },
          },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { controlCode: "asc" },
      }),
      prisma.internalControl.count({ where }),
    ]);

    return NextResponse.json({
      data: controls,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (err: any) {
    const status = err.message.startsWith("Unauthorized") ? 401
      : err.message.startsWith("Forbidden") ? 403
      : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforcePermission(user.role, "controls:write");

    const body = await request.json();
    const validated = CreateControlSchema.parse(body);
    const { frameworkRequirementIds, ...controlData } = validated;

    const control = await prisma.internalControl.create({
      data: {
        ...controlData,
        tags: controlData.tags ?? [],
        ...(frameworkRequirementIds?.length
          ? {
              frameworkMappings: {
                create: frameworkRequirementIds.map((reqId) => ({
                  requirementId: reqId,
                })),
              },
            }
          : {}),
      },
      include: {
        frameworkMappings: {
          include: { requirement: { include: { framework: true } } },
        },
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "CREATE_CONTROL",
        entityType: "InternalControl",
        entityId: control.id,
        changes: { created: control },
      },
    });

    return NextResponse.json({ data: control }, { status: 201 });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return NextResponse.json({ error: "Validation error", details: err.errors }, { status: 400 });
    }
    const status = err.message.startsWith("Unauthorized") ? 401
      : err.message.startsWith("Forbidden") ? 403
      : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
