import { users } from "@shared/schema";
import { isNull, sql } from "drizzle-orm";
import { db } from "./db";
import { getConversationHistoryWindowDaysForUser } from "./billing/features";

type SweepResult = {
  workspacesProcessed: number;
  messagesDeleted: number;
  conversationsDeleted: number;
  skipped: boolean;
};

let sweepRunning = false;

export async function runConversationRetentionSweep(): Promise<SweepResult> {
  if (sweepRunning) {
    return {
      workspacesProcessed: 0,
      messagesDeleted: 0,
      conversationsDeleted: 0,
      skipped: true,
    };
  }

  sweepRunning = true;
  try {
    const workspaceOwners = await db
      .select({
        id: users.id,
        role: users.role,
        plan: users.plan,
      })
      .from(users)
      .where(isNull(users.workspaceOwnerId));

    let workspacesProcessed = 0;
    let messagesDeleted = 0;
    let conversationsDeleted = 0;

    for (const owner of workspaceOwners) {
      const historyDays = getConversationHistoryWindowDaysForUser(owner as any);
      if (historyDays === null) {
        continue;
      }

      workspacesProcessed += 1;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - historyDays);

      const messageDeleteResult = await db.execute(sql`
        delete from messages m
        using conversations c, platforms p
        where m.conversation_id = c.id
          and c.platform_id = p.id
          and p.user_id = ${owner.id}
          and m.created_at < ${cutoff}
      `);
      messagesDeleted += Number((messageDeleteResult as any)?.rowCount ?? 0);

      const conversationDeleteResult = await db.execute(sql`
        delete from conversations c
        using platforms p
        where c.platform_id = p.id
          and p.user_id = ${owner.id}
          and c.updated_at < ${cutoff}
          and not exists (
            select 1 from messages m
            where m.conversation_id = c.id
          )
      `);
      conversationsDeleted += Number((conversationDeleteResult as any)?.rowCount ?? 0);
    }

    return {
      workspacesProcessed,
      messagesDeleted,
      conversationsDeleted,
      skipped: false,
    };
  } finally {
    sweepRunning = false;
  }
}

export function scheduleConversationRetentionSweep(logFn: (line: string) => void): NodeJS.Timeout {
  const intervalMs = Number(process.env.RETENTION_SWEEP_INTERVAL_MS ?? 24 * 60 * 60 * 1000);
  const safeIntervalMs = Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 24 * 60 * 60 * 1000;

  const runAndLog = async () => {
    try {
      const result = await runConversationRetentionSweep();
      if (!result.skipped) {
        logFn(
          `retention sweep: workspaces=${result.workspacesProcessed}, messagesDeleted=${result.messagesDeleted}, conversationsDeleted=${result.conversationsDeleted}`,
        );
      }
    } catch (error: any) {
      logFn(`retention sweep error: ${error?.message || "unknown error"}`);
    }
  };

  // Run soon after startup, then continue on interval.
  setTimeout(() => {
    void runAndLog();
  }, 30_000);

  return setInterval(() => {
    void runAndLog();
  }, safeIntervalMs);
}
