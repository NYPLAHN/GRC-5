import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { enforcePermission } from "@/lib/rbac";
import { z } from "zod";

const CreatePolicySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  owner: z.string().optional(),
  status: z.enum(["DRAFT", "IN_REVIEW", "APPROVED", "RETIRED"]).optional(),
  version: z.string().optional(),
  effectiveDate: z.string().optional(),
  approvedBy: z.string().optional(),
  reviewCadence: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL"]).optional(),
  nextReviewDate: z.string().optional(),
  fileName: z.string().optional(),
  fileSize: z.number().int().positive().optional(),
  storageKey: z.string().optional(),
  relatedControls: z.array(z.string()).optional(),
});

export async function GET() {
  try {
    const user = await requireAuth();
    enforcePermission(user.role, "policies:read");

    const policies = await prisma.policy.findMany({
      include: {
        revisions: { orderBy: { createdAt: "desc" } },
      },
      orderBy: { policyCode: "asc" },
    });

    return NextResponse.json({ data: policies });
  } catch (err: any) {
    const status = err.message.startsWith("Unauthorized") ? 401
      : err.message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforcePermission(user.role, "policies:write");

    const body = await request.json();
    const validated = CreatePolicySchema.parse(body);

    // Sequential policy code
    const last = await prisma.policy.findFirst({ orderBy: { policyCode: "desc" } });
    const lastNum = last ? parseInt(last.policyCode.replace("POL-", ""), 10) : 0;
    const policyCode = `POL-${String(lastNum + 1).padStart(3, "0")}`;

    const policy = await prisma.policy.create({
      data: {
        policyCode,
        ...validated,
        version: validated.version ?? "1.0",
        effectiveDate: validated.effectiveDate ? new Date(validated.effectiveDate) : null,
        nextReviewDate: validated.nextReviewDate ? new Date(validated.nextReviewDate) : null,
        relatedControls: validated.relatedControls ?? [],
        revisions: {
          create: {
            version: validated.version ?? "1.0",
            summary: validated.fileName
              ? `Initial upload of "${validated.fileName}"`
              : "Policy record created",
            changedBy: user.name ?? user.email,
          },
        },
      },
      include: { revisions: { orderBy: { createdAt: "desc" } } },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "CREATE_POLICY",
        entityType: "Policy",
        entityId: policy.id,
        changes: { created: { policyCode, name: policy.name } },
      },
    });

    return NextResponse.json({ data: policy }, { status: 201 });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return NextResponse.json({ error: "Validation error", details: err.errors }, { status: 400 });
    }
    const status = err.message.startsWith("Unauthorized") ? 401
      : err.message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
