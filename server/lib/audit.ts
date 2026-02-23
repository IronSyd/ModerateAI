import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { auditEvents, type AuditEvent } from "@shared/schema";

export type AuditEventInput = {
  ownerUserId: number;
  actorUserId?: number | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  details?: Record<string, unknown> | null;
};

export async function recordAuditEvent(input: AuditEventInput): Promise<void> {
  await db.insert(auditEvents).values({
    ownerUserId: input.ownerUserId,
    actorUserId: input.actorUserId ?? null,
    action: input.action,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    details: input.details ?? {},
    createdAt: new Date(),
  } as any);
}

export async function getAuditEventsForWorkspace(ownerUserId: number, limit: number): Promise<AuditEvent[]> {
  const safeLimit = Math.max(1, Math.min(1000, limit));
  return db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.ownerUserId, ownerUserId))
    .orderBy(desc(auditEvents.createdAt))
    .limit(safeLimit);
}

export async function getAuditEventsByAction(
  ownerUserId: number,
  action: string,
  limit: number,
): Promise<AuditEvent[]> {
  const safeLimit = Math.max(1, Math.min(1000, limit));
  return db
    .select()
    .from(auditEvents)
    .where(and(eq(auditEvents.ownerUserId, ownerUserId), eq(auditEvents.action, action)))
    .orderBy(desc(auditEvents.createdAt))
    .limit(safeLimit);
}
