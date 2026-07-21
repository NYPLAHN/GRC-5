import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { enforcePermission } from "@/lib/rbac";
import { z } from "zod";

const CreateEvidenceSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  fileName: z.string().min(1),
  fileSize: z.number().int().positive(),
  fileType: z.enum(["PDF", "IMAGE", "CSV", "JSON", "OTHER"]),
  storageKey: z.string().min(1), // S3 key, GCS path, or local path
  controlId: z.string().optional(),
  riskId: z.string().optional(),
  assessmentResultId: z.string().optional(),
  expiresAt: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforcePermission(user.role, "evidence:read");

    const { searchParams } = new URL(request.url);
    const controlId = searchParams.get("controlId");
    const riskId = searchParams.get("riskId");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") ?? "1");
    const pageSize = parseInt(searchParams.get("pageSize") ?? "25");

    const where = {
      ...(controlId ? { controlId } : {}),
      ...(riskId ? { riskId } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" as const } },
              { fileName: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [evidence, total] = await Promise.all([
      prisma.evidence.findMany({
        where,
        include: {
          uploader: { select: { id: true, name: true, email: true } },
          control: { select: { controlCode: true, title: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.evidence.count({ where }),
    ]);

    return NextResponse.json({
      data: evidence,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (err: any) {
    const status = err.message.startsWith("Unauthorized") ? 401
      : err.message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforcePermission(user.role, "evidence:write");

    const body = await request.json();
    const validated = CreateEvidenceSchema.parse(body);

    // Version tracking: if evidence with same title + controlId exists,
    // increment version number
    const existingCount = await prisma.evidence.count({
      where: {
        title: validated.title,
        controlId: validated.controlId ?? undefined,
      },
    });

    const evidence = await prisma.evidence.create({
      data: {
        ...validated,
        uploadedBy: user.id,
        tags: validated.tags ?? [],
        expiresAt: validated.expiresAt ? new Date(validated.expiresAt) : null,
        version: existingCount + 1,
      },
      include: {
        uploader: { select: { id: true, name: true, email: true } },
        control: { select: { controlCode: true, title: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "UPLOAD_EVIDENCE",
        entityType: "Evidence",
        entityId: evidence.id,
        changes: {
          fileName: evidence.fileName,
          controlId: evidence.controlId,
          version: evidence.version,
        },
      },
    });

    return NextResponse.json({ data: evidence }, { status: 201 });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return NextResponse.json({ error: "Validation error", details: err.errors }, { status: 400 });
    }
    const status = err.message.startsWith("Unauthorized") ? 401
      : err.message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
