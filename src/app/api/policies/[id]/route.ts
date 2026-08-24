import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { enforcePermission } from "@/lib/rbac";
import { z } from "zod";

const UpdatePolicySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  owner: z.string().optional(),
  status: z.enum(["DRAFT", "IN_REVIEW", "APPROVED", "RETIRED"]).optional(),
  version: z.string().optional(),
  effectiveDate: z.string().nullable().optional(),
  approvedBy: z.string().optional(),
  reviewCadence: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL"]).optional(),
  nextReviewDate: z.string().nullable().optional(),
  fileName: z.string().optional(),
  fileSize: z.number().int().positive().optional(),
  storageKey: z.string().optional(),
  relatedControls: z.array(z.string()).optional(),
  // Workflow helpers
  revisionSummary: z.string().optional(), // logs a revision entry with this summary
  markReviewed: z.boolean().optional(),   // stamps lastReviewedAt + advances nextReviewDate by cadence
});

const CADENCE_MONTHS: Record<string, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMI_ANNUAL: 6,
  ANNUAL: 12,
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    enforcePermission(user.role, "policies:write");

    const body = await request.json();
    const { revisionSummary, markReviewed, ...fields } = UpdatePolicySchema.parse(body);

    const current = await prisma.policy.findUnique({ where: { id: params.id } });
    if (!current) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }

    // Review workflow: stamp review + advance the next review date by cadence
    let reviewUpdate = {};
    if (markReviewed) {
      const cadence = fields.reviewCadence ?? current.reviewCadence;
      const months = CADENCE_MONTHS[cadence] ?? 12;
      const next = new Date();
      next.setMonth(next.getMonth() + months);
      reviewUpdate = { lastReviewedAt: new Date(), nextReviewDate: next };
    }

    const policy = await prisma.policy.update({
      where: { id: params.id },
      data: {
        ...fields,
        effectiveDate:
          fields.effectiveDate === null ? null
          : fields.effectiveDate ? new Date(fields.effectiveDate)
          : undefined,
        nextReviewDate:
          fields.nextReviewDate === null ? null
          : fields.nextReviewDate ? new Date(fields.nextReviewDate)
          : undefined,
        ...reviewUpdate,
        // Log a revision when a summary is provided or a review completed
        ...(revisionSummary || markReviewed
          ? {
              revisions: {
                create: {
                  version: fields.version ?? current.version,
                  summary: revisionSummary
                    ? revisionSummary
                    : `Review completed — no changes required (${(fields.reviewCadence ?? current.reviewCadence).toLowerCase().replace("_", "-")} cadence)`,
                  changedBy: user.name ?? user.email,
                },
              },
            }
          : {}),
      },
      include: { revisions: { orderBy: { createdAt: "desc" } } },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: markReviewed ? "REVIEW_POLICY" : "UPDATE_POLICY",
        entityType: "Policy",
        entityId: policy.id,
        changes: { updated: fields, markReviewed: markReviewed ?? false },
      },
    });

    return NextResponse.json({ data: policy });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return NextResponse.json({ error: "Validation error", details: err.errors }, { status: 400 });
    }
    const status = err.message.startsWith("Unauthorized") ? 401
      : err.message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
