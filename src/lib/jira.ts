/**
 * Jira REST API Integration
 *
 * Handles outbound POST requests to Jira Cloud when a remediation
 * is created in the GRC platform (Requirement: GRC → Jira two-way sync hook).
 *
 * Env vars required:
 *   JIRA_BASE_URL      – e.g. https://your-org.atlassian.net
 *   JIRA_API_TOKEN     – Atlassian API token
 *   JIRA_USER_EMAIL    – Email associated with the API token
 *   JIRA_PROJECT_KEY   – Jira project key (e.g. GRC, SEC)
 */

import type { JiraIssuePayload, JiraIssueResponse } from "@/types";

const JIRA_BASE_URL = process.env.JIRA_BASE_URL ?? "";
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN ?? "";
const JIRA_USER_EMAIL = process.env.JIRA_USER_EMAIL ?? "";
const DEFAULT_PROJECT_KEY = process.env.JIRA_PROJECT_KEY ?? "GRC";

function getAuthHeader(): string {
  const credentials = Buffer.from(`${JIRA_USER_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");
  return `Basic ${credentials}`;
}

function isConfigured(): boolean {
  return Boolean(JIRA_BASE_URL && JIRA_API_TOKEN && JIRA_USER_EMAIL);
}

// ─── Map GRC priority (1-4) to Jira priority name ─────────────

function mapPriority(priority: number): JiraIssuePayload["priority"] {
  switch (priority) {
    case 1: return "Highest";
    case 2: return "High";
    case 3: return "Medium";
    case 4: return "Low";
    default: return "Medium";
  }
}

// ─── Create a Jira issue from a GRC remediation ───────────────

export interface CreateJiraIssueInput {
  remediationId: string;
  title: string;
  description: string;
  controlCode: string;
  priority: number;
  dueDate?: string;
  assigneeAccountId?: string;
}

export async function createJiraIssue(
  input: CreateJiraIssueInput
): Promise<JiraIssueResponse> {
  if (!isConfigured()) {
    throw new Error(
      "Jira integration is not configured. Set JIRA_BASE_URL, JIRA_API_TOKEN, and JIRA_USER_EMAIL."
    );
  }

  const payload = {
    fields: {
      project: { key: DEFAULT_PROJECT_KEY },
      summary: `[GRC-${input.controlCode}] ${input.title}`,
      description: {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: input.description,
              },
            ],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: `GRC Remediation ID: ${input.remediationId}`,
                marks: [{ type: "strong" }],
              },
            ],
          },
        ],
      },
      issuetype: { name: "Task" },
      priority: { name: mapPriority(input.priority) },
      labels: ["grc-platform", `control-${input.controlCode.toLowerCase()}`],
      ...(input.dueDate ? { duedate: input.dueDate } : {}),
      ...(input.assigneeAccountId
        ? { assignee: { accountId: input.assigneeAccountId } }
        : {}),
    },
  };

  const response = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Jira API error ${response.status}: ${errorText}`
    );
  }

  const data = (await response.json()) as JiraIssueResponse;
  return data;
}

// ─── Update an existing Jira issue status via transition ──────

export async function transitionJiraIssue(
  issueKey: string,
  transitionName: "In Progress" | "Done" | "Won't Do"
): Promise<void> {
  if (!isConfigured()) return;

  // First, get available transitions
  const transResponse = await fetch(
    `${JIRA_BASE_URL}/rest/api/3/issue/${issueKey}/transitions`,
    {
      headers: {
        Authorization: getAuthHeader(),
        Accept: "application/json",
      },
    }
  );

  if (!transResponse.ok) return;

  const { transitions } = (await transResponse.json()) as {
    transitions: { id: string; name: string }[];
  };

  const transition = transitions.find((t) =>
    t.name.toLowerCase().includes(transitionName.toLowerCase())
  );

  if (!transition) {
    console.warn(`Jira transition '${transitionName}' not found for issue ${issueKey}`);
    return;
  }

  await fetch(`${JIRA_BASE_URL}/rest/api/3/issue/${issueKey}/transitions`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ transition: { id: transition.id } }),
  });
}

// ─── Webhook payload shape (for incoming Jira → GRC hooks) ────

export interface JiraWebhookPayload {
  webhookEvent: string;
  issue: {
    key: string;
    fields: {
      status: { name: string };
      resolution?: { name: string };
    };
  };
}

export function isJiraConfigured(): boolean {
  return isConfigured();
}
