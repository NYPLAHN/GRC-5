import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { enforcePermission } from "@/lib/rbac";
import { computeVendorRiskScore } from "@/lib/vra";
import { z } from "zod";

const VendorFieldsSchema = z.object({
  name: z.string().min(1),
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
});

export async function GET() {
  try {
    const user = await requireAuth();
    enforcePermission(user.role, "vendors:read");

    const vendors = await prisma.vendor.findMany({
      include: { vraResponses: true },
      orderBy: { vendorCode: "asc" },
    });

    return NextResponse.json({ data: vendors });
  } catch (err: any) {
    const status = err.message.startsWith("Unauthorized") ? 401
      : err.message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    enforcePermission(user.role, "vendors:write");

    const body = await request.json();
    const validated = VendorFieldsSchema.parse(body);

    const last = await prisma.vendor.findFirst({ orderBy: { vendorCode: "desc" } });
    const lastNum = last ? parseInt(last.vendorCode.replace("VEN-", ""), 10) : 0;
    const vendorCode = `VEN-${String(lastNum + 1).padStart(3, "0")}`;

    const riskScore = computeVendorRiskScore(
      {
        criticality: validated.criticality ?? "MEDIUM",
        dataProcessed: validated.dataProcessed ?? [],
        storesNyplData: validated.storesNyplData ?? false,
        userCount: validated.userCount ?? null,
        hosting: validated.hosting ?? null,
        ssoEnabled: validated.ssoEnabled ?? false,
        mfaEnforced: validated.mfaEnforced ?? false,
      },
      []
    ).total;

    const vendor = await prisma.vendor.create({
      data: {
        vendorCode,
        ...validated,
        dataProcessed: validated.dataProcessed ?? [],
        nextReviewDate: validated.nextReviewDate ? new Date(validated.nextReviewDate) : null,
        contractRenewal: validated.contractRenewal ? new Date(validated.contractRenewal) : null,
        riskScore,
      },
      include: { vraResponses: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "CREATE_VENDOR",
        entityType: "Vendor",
        entityId: vendor.id,
        changes: { created: { vendorCode, name: vendor.name } },
      },
    });

    return NextResponse.json({ data: vendor }, { status: 201 });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return NextResponse.json({ error: "Validation error", details: err.errors }, { status: 400 });
    }
    const status = err.message.startsWith("Unauthorized") ? 401
      : err.message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
