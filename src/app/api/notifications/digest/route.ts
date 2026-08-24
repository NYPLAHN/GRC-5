import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { gatherAlerts, type AlertItem } from "@/lib/alerts";
import { computePostureMetrics, capturePostureSnapshot } from "@/lib/posture";

/**
 * Outbound digest — pushes a "needs attention" summary to Slack
 * via incoming webhook (SLACK_WEBHOOK_URL in .env).
 *
 *  • POST (signed-in user)  → "Send digest now" button in the bell dropdown
 *  • GET  ?key=CRON_SECRET  → for external schedulers (cron / launchd / GitHub Action):
 *        curl "https://your-host/api/notifications/digest?key=$CRON_SECRET"
 */

const TYPE_LABELS: Record<AlertItem["type"], string> = {
  OVERDUE_REMEDIATION: "Overdue remediations",
  VENDOR_REVIEW: "Vendor reviews overdue",
  POLICY_REVIEW: "Policy reviews overdue",
  EXCEPTION_REVIEW: "Risk exception reviews overdue",
  EXPIRED_EVIDENCE: "Expired evidence",
  EXPIRING_EVIDENCE: "Evidence expiring soon",
  CRITICAL_RISK: "Critical open risks",
};

async function buildAndSendDigest(): Promise<{ sent?: boolean; notConfigured?: boolean; alerts: number; error?: string }> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  // Capture today's snapshot as part of the digest run (keeps trends
  // populated even if nobody opens the dashboard).
  await capturePostureSnapshot();

  const [alerts, metrics] = await Promise.all([gatherAlerts(), computePostureMetrics()]);

  if (!webhookUrl) {
    return { notConfigured: true, alerts: alerts.length };
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  // Group alerts by type, cap lines to keep Slack message readable
  const grouped = new Map<AlertItem["type"], AlertItem[]>();
  alerts.forEach((a) => {
    if (!grouped.has(a.type)) grouped.set(a.type, []);
    grouped.get(a.type)!.push(a);
  });

  const lines: string[] = [];
  lines.push(`*NYPL GRC Digest — ${today}*`);
  lines.push(
    [
      metrics.complianceScore !== null ? `NIST CSF compliance: *${metrics.complianceScore}%*` : null,
      metrics.controlRiskScore !== null ? `Control risk: *${metrics.controlRiskScore}/100*` : null,
      `Open risks: *${metrics.risksOpen}* (${metrics.risksCritical} critical)`,
      `Open remediations: *${metrics.remediationsOpen}* (${metrics.remediationsOverdue} overdue)`,
      metrics.vendorRiskAvg !== null ? `Vendor risk avg: *${metrics.vendorRiskAvg}/100*` : null,
    ].filter(Boolean).join("  ·  ")
  );
  lines.push("");

  if (alerts.length === 0) {
    lines.push(":tada: Nothing needs attention — all reviews, remediations, and evidence are current.");
  } else {
    lines.push(`*Needs attention (${alerts.length}):*`);
    for (const [type, items] of Array.from(grouped.entries())) {
      lines.push(`\n*${TYPE_LABELS[type]} (${items.length})*`);
      items.slice(0, 5).forEach((a) => lines.push(`• ${a.title} — ${a.detail}`));
      if (items.length > 5) lines.push(`• …and ${items.length - 5} more`);
    }
  }
  lines.push(`\n<${appUrl}/dashboard|Open the GRC dashboard>`);

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: lines.join("\n") }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { sent: false, alerts: alerts.length, error: `Slack webhook returned ${res.status} ${detail.slice(0, 100)}` };
  }
  return { sent: true, alerts: alerts.length };
}

/** Manual "send now" from inside the app. */
export async function POST() {
  try {
    await requireAuth();
    const result = await buildAndSendDigest();
    if (result.error) return NextResponse.json({ error: result.error }, { status: 502 });
    return NextResponse.json({ data: result });
  } catch (err: any) {
    const status = err.message.startsWith("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

/** Scheduler entry point — authenticated by CRON_SECRET, not a session. */
export async function GET(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    const key = new URL(request.url).searchParams.get("key") ?? request.headers.get("x-cron-secret");
    if (!secret || key !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const result = await buildAndSendDigest();
    if (result.error) return NextResponse.json({ error: result.error }, { status: 502 });
    return NextResponse.json({ data: result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
