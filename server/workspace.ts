import type { User } from "@shared/schema";

export type WorkspaceRole = "viewer" | "moderator" | "admin";

const ROLE_ORDER: Record<WorkspaceRole, number> = {
  viewer: 0,
  moderator: 1,
  admin: 2,
};

export function normalizeWorkspaceRole(input: unknown): WorkspaceRole {
  const value = String(input ?? "").toLowerCase().trim();
  if (value === "admin") return "admin";
  if (value === "moderator") return "moderator";
  return "viewer";
}

export function isWorkspaceMember(user: User): boolean {
  const ownerId = (user as any).workspaceOwnerId;
  return typeof ownerId === "number" && ownerId > 0;
}

export function getWorkspaceOwnerId(user: User): number {
  const ownerId = (user as any).workspaceOwnerId;
  if (typeof ownerId === "number" && ownerId > 0) return ownerId;
  return user.id;
}

export function getWorkspaceRole(user: User): WorkspaceRole {
  // System admins/owners always get workspace-admin access.
  if (user.role === "owner" || user.role === "admin") return "admin";

  // Workspace owners are implicitly workspace admins.
  if (!isWorkspaceMember(user)) return "admin";

  return normalizeWorkspaceRole((user as any).workspaceRole);
}

export function hasWorkspaceRole(user: User, required: WorkspaceRole): boolean {
  return ROLE_ORDER[getWorkspaceRole(user)] >= ROLE_ORDER[required];
}

