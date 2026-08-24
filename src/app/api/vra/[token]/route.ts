import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeVendorRiskScore, VRA_QUESTIONS } from "@/lib/vra";
import { z } from "zod";

/**
 * Public, token-gated vendor self-service VRA.
 * No session auth — the unguessable token IS the credential.
 * Exposes only the vendor's name and the question bank; never
 * internal fields like risk score or notes.
 */

const SubmitSchema = z.object({
  respondentName: z.string().min(1).max(200),
  respondentEmail: z.string().email().max(200),
  responses: z
    .array(
      z.object({
        questionId: z.string(),
        answer: z.enum(["YES", "NO", "NA"]),
        comment: z.string().max(2000).optional(),
      })
    )
    .min(1),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const vendor = await prisma.vendor.findUnique({
      where: { vraToken: params.token },
      select: { name: true, vraStatus: true, vraCompletedAt: true },
    });
    if (!vendor) {
      return NextResponse.json({ error: "This assessment link is invalid or has been revoked." }, { status: 404 });
    }
    return NextResponse.json({
      data: {
        vendorName: vendor.name,
        alreadyCompleted: vendor.vraStatus === "COMPLETED" || vendor.vraStatus === "REVIEWED",
        completedAt: vendor.vraCompletedAt,
        questions: VRA_QUESTIONS,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Something went wrong loading the assessment." }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const vendor = await prisma.vendor.findUnique({
      where: { vraToken: params.token },
      include: { vraResponses: true },
    });
    if (!vendor) {
      return NextResponse.json({ error: "This assessment link is invalid or has been revoked." }, { status: 404 });
    }
    if (vendor.vraStatus === "COMPLETED" || vendor.vraStatus === "REVIEWED") {
      return NextResponse.json({ error: "This assessment has already been submitted. Contact NYPL to reopen it." }, { status: 409 });
    }

    const body = await request.json();
    const { respondentName, respondentEmail, responses } = SubmitSchema.parse(body);

    // Only accept known question IDs
    const validIds = new Set(VRA_QUESTIONS.map((q) => q.id));
    const cleaned = responses.filter((r) => validIds.has(r.questionId));

    for (const r of cleaned) {
      await prisma.vendorVraResponse.upsert({
        where: { vendorId_questionId: { vendorId: vendor.id, questionId: r.questionId } },
        update: { answer: r.answer, comment: r.comment },
        create: { vendorId: vendor.id, questionId: r.questionId, answer: r.answer, comment: r.comment },
      });
    }

    const allResponses = await prisma.vendorVraResponse.findMany({ where: { vendorId: vendor.id } });
    const riskScore = computeVendorRiskScore(
      {
        criticality: vendor.criticality as string,
        dataProcessed: vendor.dataProcessed,
        storesNyplData: vendor.storesNyplData,
        userCount: vendor.userCount,
        hosting: vendor.hosting,
        ssoEnabled: vendor.ssoEnabled,
        mfaEnforced: vendor.mfaEnforced,
      },
      allResponses
    ).total;

    await prisma.vendor.update({
      where: { id: vendor.id },
      data: {
        vraStatus: "COMPLETED",
        vraCompletedAt: new Date(),
        vraCompletedBy: `${respondentName} <${respondentEmail}>`,
        riskScore,
      },
    });

    return NextResponse.json({ data: { submitted: true } });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return NextResponse.json({ error: "Please complete the required fields (name, valid email, at least one answer)." }, { status: 400 });
    }
    return NextResponse.json({ error: "Something went wrong submitting the assessment." }, { status: 500 });
  }
}
