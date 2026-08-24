import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";

const ChatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      })
    )
    .min(1)
    .max(20),
});

/** Compact snapshot of the GRC program, injected as model context. */
async function buildContext(): Promise<string> {
  const [controls, risks, remediations, policies, vendors, latestAssessment] = await Promise.all([
    prisma.internalControl.findMany({
      select: {
        controlCode: true, title: true, status: true, criticality: true,
        maturityLevel: true, category: true, owner: true,
        _count: { select: { evidence: true } },
      },
      orderBy: { controlCode: "asc" },
      take: 300,
    }),
    prisma.risk.findMany({
      select: {
        riskId: true, title: true, category: true, source: true, owner: true, riskLead: true,
        likelihood: true, impact: true, velocity: true, inherentScore: true, residualScore: true,
        treatment: true, isOpen: true, isException: true, exceptionNextReview: true,
      },
      orderBy: { inherentScore: "desc" },
      take: 300,
    }),
    prisma.remediation.findMany({
      select: {
        title: true, status: true, priority: true, complexity: true, dueDate: true, resolvedAt: true,
        jiraIssueKey: true,
        control: { select: { controlCode: true } },
        risk: { select: { riskId: true } },
        assignee: { select: { name: true, email: true } },
      },
      orderBy: [{ priority: "asc" }],
      take: 300,
    }),
    prisma.policy.findMany({
      select: {
        policyCode: true, name: true, category: true, status: true, version: true,
        owner: true, nextReviewDate: true, lastReviewedAt: true, relatedControls: true,
      },
      orderBy: { policyCode: "asc" },
      take: 100,
    }).catch(() => []),
    prisma.vendor.findMany({
      select: {
        vendorCode: true, name: true, applicationOwner: true, businessUnit: true,
        criticality: true, status: true, hosting: true, ssoEnabled: true, mfaEnforced: true,
        userCount: true, dataProcessed: true, attestationType: true, cyberInsurance: true,
        riskScore: true, vraStatus: true, nextReviewDate: true,
      },
      orderBy: { vendorCode: "asc" },
      take: 200,
    }).catch(() => []),
    prisma.assessment.findFirst({
      orderBy: { createdAt: "desc" },
      include: {
        conductor: { select: { name: true, version: true } },
        results: { select: { status: true } },
      },
    }),
  ]);

  let assessmentSummary = null;
  if (latestAssessment) {
    const total = latestAssessment.results.length;
    const compliant = latestAssessment.results.filter((r) => r.status === "COMPLIANT").length;
    const partial = latestAssessment.results.filter((r) => r.status === "PARTIAL").length;
    const nonCompliant = latestAssessment.results.filter((r) => r.status === "NON_COMPLIANT").length;
    assessmentSummary = {
      title: latestAssessment.title,
      framework: `${latestAssessment.conductor.name} v${latestAssessment.conductor.version}`,
      date: latestAssessment.startDate,
      total, compliant, partial, nonCompliant,
      score: total > 0 ? Math.round(((compliant + partial * 0.5) / total) * 100) : 0,
    };
  }

  return JSON.stringify({
    asOf: new Date().toISOString(),
    controls,
    risks,
    remediations: remediations.map((r) => ({
      ...r,
      assignee: r.assignee?.name ?? r.assignee?.email,
      control: r.control?.controlCode ?? null,
      risk: r.risk?.riskId ?? null,
    })),
    policies,
    vendors,
    latestAssessment: assessmentSummary,
  });
}

const SYSTEM_PROMPT = `You are the built-in assistant for NYPL's internal GRC (governance, risk & compliance) platform. You answer questions strictly from the JSON program snapshot provided below. Rules:
- Answer only from the data. If the data doesn't contain the answer, say so plainly — never invent controls, risks, scores, or dates.
- Reference records by their IDs (IC-001, RISK-004, POL-002, VEN-003) so users can find them.
- Vendor risk scores are 0–100 (higher = riskier; ≥70 Critical, ≥50 High, ≥30 Medium).
- Scoring conventions: risk score = likelihood × impact (1–25; ≥15 Critical, ≥10 High, ≥5 Medium, <5 Low). Compliance score = (compliant + 0.5×partial) ÷ total requirements. Control maturity is 0–5 (CMMI-style).
- Be concise and direct. Use short bullet lists only when listing multiple records.
- You cannot modify data; if asked to change something, point the user to the right page (Controls Library, Risk Register, Remediation, Policy Register, Evidence Locker, Assessments, Reports).

PROGRAM SNAPSHOT:
`;

export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        notConfigured: true,
        message: "AI assistant isn't configured yet. Add ANTHROPIC_API_KEY to your .env file and restart the server.",
      });
    }

    const body = await request.json();
    const { messages } = ChatSchema.parse(body);

    const context = await buildContext();

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5",
        max_tokens: 1024,
        system: SYSTEM_PROMPT + context,
        messages,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      const detail = data?.error?.message ?? `Anthropic API error (${res.status})`;
      return NextResponse.json({ error: detail }, { status: 502 });
    }

    const reply = Array.isArray(data.content)
      ? data.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n")
      : "";

    return NextResponse.json({ data: { reply } });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return NextResponse.json({ error: "Validation error", details: err.errors }, { status: 400 });
    }
    const status = err.message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
