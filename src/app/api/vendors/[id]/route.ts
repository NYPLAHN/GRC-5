import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { enforcePermission } from "@/lib/rbac";
import { computeVendorRiskScore } from "@/lib/vra";
import { z } from "zod";
import { randomBytes } from "crypto";

const UpdateVendorSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  website: z.string().optional(),
  applicationOwner: z.string().optional(),
  businessUnit: z.string().optional(),
  criticality: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  status: z.enum(["ONBOARDING", "ACTIVE", "UNDER_REVIEW", "OFFBOARDED"]).optional(),
  hosting: z.string().optional(),
  hostingDetails: z.string().optional(),
  ssoEnabled: z.boolean().optional(),
  mfaEnforced: z.boolean().optional(),
  userCount: z.number().int().min(0).nullable().optional(),
  accessControlNotes: z.string().optional(),
  storesNyplData: z.boolean().optional(),
  dataProcessed: z.array(z.string()).optional(),
  attestationType: z.string().optional(),
  cyberInsurance: z.boolean().optional(),
  securityContactName: z.string().optional(),
  securityContactEmail: z.string().optional(),
  reviewCadence: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL"]).optional(),
  nextReviewDate: z.string().nullable().optional(),
  contractRenewal: z.string().nullable().optional(),
  notes: z.string().optional(),
  vraFileName: z.string().optional(),
  vraFileSize: z.number().int().positive().optional(),
  vraStorageKey: z.string().optional(),
  vraStatus: z.enum(["NOT_STARTED", "SENT_TO_VENDOR", "IN_PROGRESS", "COMPLETED", "REVIEWED"]).optional(),
  // VRA checklist answers (upsert)
  responses: z
    .array(
      z.object({
        questionId: z.string(),
        answer: z.enum(["YES", "NO", "NA"]),
        comment: z.string().optional(),
      })
    )
    .optional(),
  // Workflow helpers
  generateVraLink: z.boolean().optional(),
  markReviewed: z.boolean().optional(),
});

const CADENCE_MONTHS: Record<string, number> = { MONTHLY: 1, QUARTERLY: 3, SEMI_ANNUAL: 6, ANNUAL: 12 };

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    enforcePermission(user.role, "vendors:write");

    const body = await request.json();
    const { responses, generateVraLink, markReviewed, ...fields } = UpdateVendorSchema.parse(body);

    const current = await prisma.vendor.findUnique({
      where: { id: params.id },
      include: { vraResponses: true },
    });
    if (!current) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    // Upsert questionnaire responses
    if (responses?.length) {
      for (const r of responses) {
        await prisma.vendorVraResponse.upsert({
          where: { vendorId_questionId: { vendorId: params.id, questionId: r.questionId } },
          update: { answer: r.answer, comment: r.comment },
          create: { vendorId: params.id, questionId: r.questionId, answer: r.answer, comment: r.comment },
        });
      }
    }

    // Review workflow
    let reviewUpdate = {};
    if (markReviewed) {
      const cadence = fields.reviewCadence ?? current.reviewCadence;
      const months = CADENCE_MONTHS[cadence] ?? 12;
      const next = new Date();
      next.setMonth(next.getMonth() + months);
      reviewUpdate = { lastReviewedAt: new Date(), nextReviewDate: next, vraStatus: "REVIEWED" as const };
    }

    // Public VRA link generation
    let tokenUpdate = {};
    if (generateVraLink) {
      tokenUpdate = {
        vraToken: current.vraToken ?? randomBytes(24).toString("base64url"),
        vraStatus: "SENT_TO_VENDOR" as const,
      };
    }

    // Recompute risk score from merged state
    const merged = {
      criticality: fields.criticality ?? (current.criticality as string),
      dataProcessed: fields.dataProcessed ?? current.dataProcessed,
      storesNyplData: fields.storesNyplData ?? current.storesNyplData,
      userCount: fields.userCount !== undefined ? fields.userCount : current.userCount,
      hosting: fields.hosting ?? current.hosting,
      ssoEnabled: fields.ssoEnabled ?? current.ssoEnabled,
      mfaEnforced: fields.mfaEnforced ?? current.mfaEnforced,
    };
    const allResponses = await prisma.vendorVraResponse.findMany({ where: { vendorId: params.id } });
    const riskScore = computeVendorRiskScore(merged, allResponses).total;

    const vendor = await prisma.vendor.update({
      where: { id: params.id },
      data: {
        ...fields,
        nextReviewDate:
          fields.nextReviewDate === null ? null
          : fields.nextReviewDate ? new Date(fields.nextReviewDate)
          : undefined,
        contractRenewal:
          fields.contractRenewal === null ? null
          : fields.contractRenewal ? new Date(fields.contractRenewal)
          : undefined,
        riskScore,
        ...reviewUpdate,
        ...tokenUpdate,
      },
      include: { vraResponses: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: markReviewed ? "REVIEW_VENDOR" : "UPDATE_VENDOR",
        entityType: "Vendor",
        entityId: vendor.id,
        changes: { updated: Object.keys(fields), responsesUpserted: responses?.length ?? 0 },
      },
    });

    return NextResponse.json({ data: vendor });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return NextResponse.json({ error: "Validation error", details: err.errors }, { status: 400 });
    }
    const status = err.message.startsWith("Unauthorized") ? 401
      : err.message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
