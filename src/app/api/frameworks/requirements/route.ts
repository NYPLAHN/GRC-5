import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug") ?? "NIST_CSF_2";

    const framework = await prisma.framework.findUnique({
      where: { slug: slug as any },
    });

    if (!framework) {
      return NextResponse.json({ error: "Framework not found" }, { status: 404 });
    }

    const requirements = await prisma.frameworkRequirement.findMany({
      where: { frameworkId: framework.id },
      select: {
        id: true,
        controlId: true,
        category: true,
        subCategory: true,
        title: true,
      },
      orderBy: { controlId: "asc" },
    });

    return NextResponse.json({ data: requirements, frameworkId: framework.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
