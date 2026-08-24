import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

/**
 * Minimal user directory for assignment dropdowns
 * (remediation assignee, risk lead, etc.). Any authenticated
 * user may read it — it exposes only id, name, email, role.
 */
export async function GET() {
  try {
    await requireAuth();
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true },
      orderBy: [{ name: "asc" }, { email: "asc" }],
    });
    return NextResponse.json({ data: users });
  } catch (err: any) {
    const status = err.message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
