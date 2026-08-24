import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { enforcePermission } from "@/lib/rbac";
import { capturePostureSnapshot, getPostureTrend } from "@/lib/posture";

export async function GET() {
  try {
    const user = await requireAuth();
    enforcePermission(user.role, "reports:read");
    const data = await getPostureTrend(180);
    return NextResponse.json({ data });
  } catch (err: any) {
    const status = err.message.startsWith("Unauthorized") ? 401
      : err.message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

/** Capture today's snapshot on demand (idempotent). */
export async function POST() {
  try {
    const user = await requireAuth();
    enforcePermission(user.role, "reports:read");
    const snapshot = await capturePostureSnapshot();
    return NextResponse.json({ data: snapshot });
  } catch (err: any) {
    const status = err.message.startsWith("Unauthorized") ? 401
      : err.message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
