import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const includeRequirements = searchParams.get("requirements") === "true";

    const frameworks = await prisma.framework.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { requirements: true } },
        ...(includeRequirements
          ? {
              requirements: {
                select: { id: true, controlId: true, category: true, title: true },
                orderBy: { controlId: "asc" as const },
              },
            }
          : {}),
      },
    });
    return NextResponse.json({ data: frameworks });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
