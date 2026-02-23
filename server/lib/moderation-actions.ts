import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../db";
import { moderationActions, type ModerationAction } from "@shared/schema";

export type ModerationActionInput = {
  ownerUserId: number;
  platformId: number;
  conversationId?: number | null;
  messageId?: number | null;
  platformType: string;
  action: string;
  ruleSource: string;
  reason?: string | null;
  automatic?: boolean;
  actorUserId?: number | null;
  metadata?: Record<string, unknown> | null;
};

export type ModerationActionQuery = {
  limit: number;
  platformId?: number;
  action?: string;
  from?: Date;
  to?: Date;
};

export async function recordModerationAction(input: ModerationActionInput): Promise<ModerationAction> {
  const [created] = await db
    .insert(moderationActions)
    .values({
      ownerUserId: input.ownerUserId,
      platformId: input.platformId,
      conversationId: input.conversationId ?? null,
      messageId: input.messageId ?? null,
      platformType: String(input.platformType).toLowerCase(),
      action: input.action,
      ruleSource: input.ruleSource,
      reason: input.reason ?? null,
      automatic: input.automatic ?? true,
      actorUserId: input.actorUserId ?? null,
      metadata: input.metadata ?? {},
      createdAt: new Date(),
    } as any)
    .returning();

  return created;
}

export async function listModerationActionsForWorkspace(
  ownerUserId: number,
  query: ModerationActionQuery,
): Promise<ModerationAction[]> {
  const safeLimit = Math.max(1, Math.min(1000, query.limit));
  const filters = [eq(moderationActions.ownerUserId, ownerUserId)];

  if (typeof query.platformId === "number") {
    filters.push(eq(moderationActions.platformId, query.platformId));
  }
  if (query.action) {
    filters.push(eq(moderationActions.action, query.action));
  }
  if (query.from) {
    filters.push(gte(moderationActions.createdAt, query.from));
  }
  if (query.to) {
    filters.push(lte(moderationActions.createdAt, query.to));
  }

  return db
    .select()
    .from(moderationActions)
    .where(and(...filters))
    .orderBy(desc(moderationActions.createdAt))
    .limit(safeLimit);
}

export async function getModerationActionCountsForPlatform(platformId: number): Promise<Record<string, number>> {
  const rows = await db
    .select({
      action: moderationActions.action,
      count: sql<number>`count(*)::int`,
    })
    .from(moderationActions)
    .where(eq(moderationActions.platformId, platformId))
    .groupBy(moderationActions.action);

  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.action] = Number(row.count ?? 0);
  }
  return counts;
}
