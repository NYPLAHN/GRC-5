/**
 * Role-Based Access Control (RBAC) utilities
 *
 * Three tiers:
 *   ADMIN       – Full system access (read + write + admin)
 *   CONTRIBUTOR – Assessments, evidence, remediations (read + write, no admin)
 *   VIEWER      – Executive reporting only (read-only)
 */

import type { UserRole } from "@/types";

// ─── Permission matrix ────────────────────────────────────────

type Action =
  | "controls:read"
  | "controls:write"
  | "risks:read"
  | "risks:write"
  | "assessments:read"
  | "assessments:write"
  | "evidence:read"
  | "evidence:write"
  | "remediation:read"
  | "remediation:write"
  | "reports:read"
  | "admin:users"
  | "admin:settings"
  | "integrations:jira";

const ROLE_PERMISSIONS: Record<UserRole, Action[]> = {
  ADMIN: [
    "controls:read", "controls:write",
    "risks:read", "risks:write",
    "assessments:read", "assessments:write",
    "evidence:read", "evidence:write",
    "remediation:read", "remediation:write",
    "reports:read",
    "admin:users", "admin:settings",
    "integrations:jira",
  ],
  CONTRIBUTOR: [
    "controls:read",
    "risks:read", "risks:write",
    "assessments:read", "assessments:write",
    "evidence:read", "evidence:write",
    "remediation:read", "remediation:write",
    "reports:read",
  ],
  VIEWER: [
    "controls:read",
    "risks:read",
    "assessments:read",
    "evidence:read",
    "remediation:read",
    "reports:read",
  ],
};

// ─── Helpers ──────────────────────────────────────────────────

export function can(role: UserRole, action: Action): boolean {
  return ROLE_PERMISSIONS[role]?.includes(action) ?? false;
}

export function requireRole(userRole: UserRole, minimumRole: UserRole): void {
  const hierarchy: UserRole[] = ["VIEWER", "CONTRIBUTOR", "ADMIN"];
  const userLevel = hierarchy.indexOf(userRole);
  const requiredLevel = hierarchy.indexOf(minimumRole);
  if (userLevel < requiredLevel) {
    throw new Error(
      `Forbidden: requires ${minimumRole} role, user has ${userRole}`
    );
  }
}

export function isAdmin(role: UserRole): boolean {
  return role === "ADMIN";
}

export function isContributorOrAbove(role: UserRole): boolean {
  return role === "ADMIN" || role === "CONTRIBUTOR";
}

/**
 * Server-side guard that throws a structured 403 error when the
 * user lacks the required permission.
 */
export function enforcePermission(userRole: UserRole, action: Action): void {
  if (!can(userRole, action)) {
    throw new Error(
      `Forbidden: you do not have permission to perform '${action}'`
    );
  }
}
