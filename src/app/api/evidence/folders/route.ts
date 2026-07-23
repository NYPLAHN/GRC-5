import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { enforcePermission } from "@/lib/rbac";
import { z } from "zod";

const CreateFolderSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().optional(),
});

export async function GET() {
  try {
    const user = await requireAuth();
    enforcePermission(user.role, "evidence:read");

    const folders = await prisma.evidenceFolder.findMany({
      include: { _count: { select: { evidence: true } } },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ data: folders });
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
    const validated = CreateFolderSchema.parse(body);

    const folder = await prisma.evidenceFolder.create({
      data: validated,
      include: { _count: { select: { evidence: true } } },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "CREATE_EVIDENCE_FOLDER",
        entityType: "EvidenceFolder",
        entityId: folder.id,
        changes: { created: { name: folder.name } },
      },
    });

    return NextResponse.json({ data: folder }, { status: 201 });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return NextResponse.json({ error: "Validation error", details: err.errors }, { status: 400 });
    }
    if (err.code === "P2002") {
      return NextResponse.json({ error: "A folder with that name already exists" }, { status: 409 });
    }
    const status = err.message.startsWith("Unauthorized") ? 401
      : err.message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
