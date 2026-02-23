import { db } from "../db";
import { teamInvitations, users } from "@shared/schema";
import { and, count, eq, gt, isNull, or } from "drizzle-orm";
import type { Entitlements } from "./entitlements";

export type SeatUsage = {
  // Active team members attached to this workspace owner (excludes the owner).
  memberCount: number;
  // Pending invitations that haven't expired (these reserve a seat immediately).
  pendingInvitationCount: number;
  // Total seats used including the owner.
  usedSeats: number;
};

export type SeatLimitErrorResponse = {
  code: "SEAT_LIMIT_REACHED";
  message: string;
  usedSeats: number;
  seatLimit: number;
};

export async function getSeatUsageForOwner(ownerUserId: number): Promise<SeatUsage> {
  const now = new Date();

  const memberRows = await db
    .select({ count: count() })
    .from(users)
    .where(and(eq(users.workspaceOwnerId, ownerUserId), eq(users.isActive, true), eq(users.isBanned, false)));

  const inviteRows = await db
    .select({ count: count() })
    .from(teamInvitations)
    .where(
      and(
        // Back-compat: older invites may not have workspaceOwnerId populated.
        or(eq(teamInvitations.workspaceOwnerId, ownerUserId), and(isNull(teamInvitations.workspaceOwnerId), eq(teamInvitations.invitedBy, ownerUserId))),
        eq(teamInvitations.status, "pending"),
        gt(teamInvitations.expiresAt, now),
      ),
    );

  const memberCount = memberRows[0]?.count ?? 0;
  const pendingInvitationCount = inviteRows[0]?.count ?? 0;
  return {
    memberCount,
    pendingInvitationCount,
    usedSeats: 1 + memberCount + pendingInvitationCount,
  };
}

export function buildSeatLimitError(usage: SeatUsage, entitlements: Entitlements): SeatLimitErrorResponse {
  const seatLimit = entitlements.seatLimit ?? 0;
  return {
    code: "SEAT_LIMIT_REACHED",
    message: "Seat limit reached for your plan.",
    usedSeats: usage.usedSeats,
    seatLimit,
  };
}

export function hasSeatCapacity(usage: SeatUsage, entitlements: Entitlements): boolean {
  const limit = entitlements.seatLimit;
  if (limit === null) return true; // unlimited
  return usage.usedSeats < limit;
}
