/**
 * Jira Webhook Receiver
 *
 * Receives inbound status-change webhooks from Jira and syncs
 * the remediation status in the GRC platform.
 *
 * Configure in Jira: Project Settings → Automation → Webhooks
 * URL: https://your-grc-domain.com/api/integrations/jira
 * Events: Issue updated (status changed)
 *
 * Security: Validates a shared secret header to prevent spoofing.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { JiraWebhookPayload } from "@/lib/jira";

const WEBHOOK_SECRET = process.env.INTERNAL_API_SECRET ?? "";

function validateWebhookSecret(request: NextRequest): boolean {
  const header = request.headers.get("x-grc-webhook-secret");
  if (!WEBHOOK_SECRET) {
    console.warn("INTERNAL_API_SECRET not set – webhook validation disabled");
    return true;
  }
  return header === WEBHOOK_SECRET;
}

function mapJiraStatusToGRC(
  jiraStatus: string
): "OPEN" | "IN_PROGRESS" | "RESOLVED" | "WONT_FIX" | null {
  const s = jiraStatus.toLowerCase();
  if (s.includes("to do") || s.includes("open") || s.includes("backlog")) return "OPEN";
  if (s.includes("in progress") || s.includes("in review")) return "IN_PROGRESS";
  if (s.includes("done") || s.includes("closed") || s.includes("resolved")) return "RESOLVED";
  if (s.includes("won't") || s.includes("wont") || s.includes("invalid")) return "WONT_FIX";
  return null;
}

export async function POST(request: NextRequest) {
  if (!validateWebhookSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: JiraWebhookPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const issueKey = payload?.issue?.key;
  const jiraStatus = payload?.issue?.fields?.status?.name;

  if (!issueKey || !jiraStatus) {
    return NextResponse.json(
      { error: "Missing issue.key or issue.fields.status.name" },
      { status: 400 }
    );
  }

  // Find the matching remediation by Jira issue key
  const remediation = await prisma.remediation.findFirst({
    where: { jiraIssueKey: issueKey },
  });

  if (!remediation) {
    // Not an issue we created; silently acknowledge
    return NextResponse.json({ acknowledged: true, matched: false });
  }

  const newStatus = mapJiraStatusToGRC(jiraStatus);
  if (!newStatus) {
    return NextResponse.json({ acknowledged: true, matched: true, statusMapped: false });
  }

  // Update remediation status
  await prisma.remediation.update({
    where: { id: remediation.id },
    data: {
      status: newStatus,
      jiraSyncedAt: new Date(),
      ...(newStatus === "RESOLVED" ? { resolvedAt: new Date() } : {}),
    },
  });

  console.log(`Jira webhook: ${issueKey} → GRC status updated to ${newStatus}`);

  return NextResponse.json({
    acknowledged: true,
    matched: true,
    remediationId: remediation.id,
    newStatus,
  });
}

// Health check for Jira webhook config verification
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "GRC Platform Jira Webhook Receiver",
    version: "1.0",
  });
}
