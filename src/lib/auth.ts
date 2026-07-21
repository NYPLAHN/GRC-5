/**
 * Auth helpers – Clerk + Prisma user synchronisation
 * Provides server-side utilities for getting the current user
 * and their GRC platform role.
 */

import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "./prisma";
import type { UserRole } from "@/types";

export interface SessionUser {
  id: string;          // Prisma user ID
  clerkId: string;
  email: string;
  name: string | null;
  role: UserRole;
}

/**
 * Returns the current authenticated user with their GRC role.
 * Creates a DB record on first login if one doesn't exist.
 * Returns null if unauthenticated.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";
  const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null;

  // Upsert: ensure the user exists in our DB (first-time login sync)
  const dbUser = await prisma.user.upsert({
    where: { clerkId: userId },
    update: { email, name },
    create: {
      clerkId: userId,
      email,
      name,
      // Default first user to ADMIN, everyone else VIEWER.
      // In production, set role via Clerk metadata or Admin UI.
      role: (clerkUser.publicMetadata?.role as UserRole) ?? "VIEWER",
    },
  });

  return {
    id: dbUser.id,
    clerkId: dbUser.clerkId,
    email: dbUser.email,
    name: dbUser.name,
    role: dbUser.role as UserRole,
  };
}

/**
 * Requires authentication. Throws a 401-style error if not logged in.
 */
export async function requireAuth(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Unauthorized: authentication required");
  }
  return user;
}
