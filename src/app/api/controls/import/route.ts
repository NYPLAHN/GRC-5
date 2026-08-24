import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { enforcePermission } from "@/lib/rbac";
import { z } from "zod";

const ImportRowSchema = z.object({
  controlCode: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "IMPLEMENTED", "NOT_APPLICABLE"]).optional(),
  criticality: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  maturityLevel: z.number().int().min(0).max(5).optional(),
  owner: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const ImportSchema = z.object({
  controls: z.array(ImportRowSchema).min(1).max(500),
});

/**
 * Bulk import controls. Upserts by controlCode:
 * existing controls are updated, new ones created.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforcePermission(user.role, "controls:write");

    const body = await request.json();
    const { controls } = ImportSchema.parse(body);

    let created = 0;
    let updated = 0;
    const errors: { controlCode: string; error: string }[] = [];

    for (const row of controls) {
      try {
        const existing = await prisma.internalControl.findUnique({
          where: { controlCode: row.controlCode },
          select: { id: true },
        });
        await prisma.internalControl.upsert({
          where: { controlCode: row.controlCode },
          update: {
            title: row.title,
            description: row.description,
            ...(row.status ? { status: row.status } : {}),
            ...(row.criticality ? { criticality: row.criticality } : {}),
            ...(row.maturityLevel !== undefined ? { maturityLevel: row.maturityLevel } : {}),
            ...(row.owner ? { owner: row.owner } : {}),
            ...(row.category ? { category: row.category } : {}),
            ...(row.tags ? { tags: row.tags } : {}),
          },
          create: {
            controlCode: row.controlCode,
            title: row.title,
            description: row.description,
            status: row.status ?? "NOT_STARTED",
            criticality: row.criticality ?? "MEDIUM",
            maturityLevel: row.maturityLevel ?? 0,
            owner: row.owner,
            category: row.category,
            tags: row.tags ?? [],
          },
        });
        if (existing) updated++;
        else created++;
      } catch (rowErr: any) {
        errors.push({ controlCode: row.controlCode, error: rowErr.message?.slice(0, 200) ?? "Unknown error" });
      }
    }

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "IMPORT_CONTROLS",
        entityType: "InternalControl",
        entityId: "bulk",
        changes: { created, updated, failed: errors.length },
      },
    });

    return NextResponse.json({ data: { created, updated, errors } }, { status: 201 });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return NextResponse.json({ error: "Validation error", details: err.errors }, { status: 400 });
    }
    const status = err.message.startsWith("Unauthorized") ? 401
      : err.message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
