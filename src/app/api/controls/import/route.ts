import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { enforcePermission } from "@/lib/rbac";
import { z } from "zod";

const ControlImportSchema = z.object({
  controls: z.array(
    z.object({
      controlCode: z.string().min(1),
      title: z.string().min(1),
      description: z.string().optional().default(""),
      status: z
        .enum(["IMPLEMENTED", "IN_PROGRESS", "NOT_STARTED", "NOT_APPLICABLE"])
        .default("NOT_STARTED"),
      owner: z.string().optional(),
      category: z.string().optional(),
      tags: z.array(z.string()).optional().default([]),
    })
  ),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforcePermission(user.role, "controls:write");

    const body = await request.json();
    const { controls } = ControlImportSchema.parse(body);

    let created = 0;
    let updated = 0;

    for (const ctrl of controls) {
      const existing = await prisma.internalControl.findUnique({
        where: { controlCode: ctrl.controlCode },
      });

      if (existing) {
        await prisma.internalControl.update({
          where: { controlCode: ctrl.controlCode },
          data: {
            title: ctrl.title,
            description: ctrl.description ?? "",
            status: ctrl.status,
            owner: ctrl.owner ?? null,
            category: ctrl.category ?? null,
            tags: ctrl.tags ?? [],
          },
        });
        updated++;
      } else {
        await prisma.internalControl.create({
          data: {
            controlCode: ctrl.controlCode,
            title: ctrl.title,
            description: ctrl.description ?? "",
            status: ctrl.status,
            owner: ctrl.owner ?? null,
            category: ctrl.category ?? null,
            tags: ctrl.tags ?? [],
          },
        });
        created++;
      }
    }

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "IMPORT_CONTROLS",
        entityType: "InternalControl",
        entityId: "bulk",
        changes: { created, updated, total: controls.length },
      },
    });

    return NextResponse.json(
      { data: { created, updated, total: controls.length } },
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
