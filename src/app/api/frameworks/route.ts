import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  try {
    await requireAuth();
    const frameworks = await prisma.framework.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { requirements: true } } },
    });
    return NextResponse.json({ data: frameworks });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
