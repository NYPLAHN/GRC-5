import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { gatherAlerts } from "@/lib/alerts";

/**
 * Aggregated action-needed alerts for the notification bell:
 * overdue remediations, expired/expiring evidence, overdue
 * exception/policy/vendor reviews, and critical open risks.
 */
export async function GET() {
  try {
    await requireAuth();
    const alerts = await gatherAlerts();
    return NextResponse.json({ data: alerts });
  } catch (err: any) {
    const status = err.message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
