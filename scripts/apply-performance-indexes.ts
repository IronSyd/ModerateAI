import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "pg";

function splitSqlStatements(sqlSource: string): string[] {
  const uncommented = sqlSource
    .split(/\r?\n/g)
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

  return uncommented
    .split(/;\s*(?:\r?\n|$)/g)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

async function main() {
  const databaseUrl = String(process.env.DATABASE_URL ?? "").trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const sqlPath = resolve(process.cwd(), "migrations", "20260220_performance_indexes.sql");
  const sqlSource = await readFile(sqlPath, "utf8");
  const statements = splitSqlStatements(sqlSource);

  if (statements.length === 0) {
    console.log("No index statements found.");
    return;
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    for (const statement of statements) {
      console.log(`Applying: ${statement.slice(0, 96)}${statement.length > 96 ? "..." : ""}`);
      await client.query(statement);
    }

    console.log("Performance indexes applied. Running EXPLAIN ANALYZE checks...");

    const ownerResult = await client.query<{ id: number }>(
      `select id from users where workspace_owner_id is null order by id asc limit 1`,
    );
    const ownerId = ownerResult.rows[0]?.id;

    if (!ownerId) {
      console.log("No workspace owner found; skipping EXPLAIN ANALYZE checks.");
      return;
    }

    const explainQueries = [
      {
        name: "dashboard_stats_aggregate",
        text: `
          EXPLAIN ANALYZE
          select
            count(distinct c.id) as total_conversations,
            coalesce(sum(case when m.sender = 'ai' then 1 else 0 end), 0) as ai_messages,
            coalesce(sum(case when m.sender = 'user' then 1 else 0 end), 0) as user_messages
          from platforms p
          left join conversations c on c.platform_id = p.id
          left join messages m on m.conversation_id = c.id
          where p.user_id = $1
        `,
      },
      {
        name: "destination_usage_grouped",
        text: `
          EXPLAIN ANALYZE
          select p.type, cc.chat_type, count(*)
          from chat_configurations cc
          inner join platforms p on p.id = cc.platform_id
          where p.user_id = $1 and cc.is_active = true
          group by p.type, cc.chat_type
        `,
      },
      {
        name: "recent_activity",
        text: `
          EXPLAIN ANALYZE
          select m.sender, m.created_at, m.metadata, p.type
          from messages m
          inner join conversations c on c.id = m.conversation_id
          inner join platforms p on p.id = c.platform_id
          where p.user_id = $1
          order by m.created_at desc
          limit 5
        `,
      },
    ];

    for (const query of explainQueries) {
      const result = await client.query(query.text, [ownerId]);
      const planText = result.rows.map((row) => String((row as any)["QUERY PLAN"] ?? "")).join("\n");
      console.log(`\n[EXPLAIN] ${query.name}\n${planText}\n`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Failed to apply performance indexes:", error);
  process.exit(1);
});
