import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

/**
 * Global search across controls, risks, remediations, and evidence.
 * Returns top 5 matches per entity type.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").trim();
    if (q.length < 2) {
      return NextResponse.json({ data: { controls: [], risks: [], remediations: [], evidence: [] } });
    }

    const contains = { contains: q, mode: "insensitive" as const };

    const [controls, risks, remediations, evidence, policies] = await Promise.all([
      prisma.internalControl.findMany({
        where: { OR: [{ controlCode: contains }, { title: contains }, { description: contains }, { category: contains }] },
        select: { id: true, controlCode: true, title: true, status: true },
        take: 5,
        orderBy: { controlCode: "asc" },
      }),
      prisma.risk.findMany({
        where: { OR: [{ riskId: contains }, { title: contains }, { description: contains }, { category: contains }] },
        select: { id: true, riskId: true, title: true, inherentScore: true, isOpen: true },
        take: 5,
        orderBy: { inherentScore: "desc" },
      }),
      prisma.remediation.findMany({
        where: { OR: [{ title: contains }, { description: contains }, { jiraIssueKey: contains }] },
        select: { id: true, title: true, status: true },
        take: 5,
        orderBy: { createdAt: "desc" },
      }),
      prisma.evidence.findMany({
        where: { OR: [{ title: contains }, { fileName: contains }] },
        select: { id: true, title: true, fileName: true, fileType: true },
        take: 5,
        orderBy: { createdAt: "desc" },
      }),
      prisma.policy.findMany({
        where: { OR: [{ policyCode: contains }, { name: contains }, { description: contains }, { category: contains }] },
        select: { id: true, policyCode: true, name: true, status: true },
        take: 5,
        orderBy: { policyCode: "asc" },
      }).catch(() => [] as { id: string; policyCode: string; name: string; status: string }[]),
    ]);

    return NextResponse.json({ data: { controls, risks, remediations, evidence, policies } });
  } catch (err: any) {
    const status = err.message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
