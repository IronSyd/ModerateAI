import "dotenv/config";
import assert from "node:assert/strict";
import { eq, inArray } from "drizzle-orm";
import { db } from "../server/db";
import { storage } from "../server/storage";
import { conversations, integrationClaimCodes, platforms, users } from "../shared/schema";

async function seedUser(email: string, fullName: string): Promise<number> {
  const [row] = await db
    .insert(users)
    .values({
      email,
      password: "edge-case-pass",
      fullName,
      role: "user",
      plan: "free",
      planStatus: "active",
      workspaceRole: "admin",
      createdAt: new Date(),
    } as any)
    .returning({ id: users.id });
  assert.ok(row?.id, `Failed to create user for ${email}`);
  return row.id;
}

async function seedPlatform(userId: number, type: "telegram" | "discord", name: string): Promise<number> {
  const [row] = await db
    .insert(platforms)
    .values({
      userId,
      type,
      name,
      status: "active",
      botOwnershipMode: "app_owned",
      config: {},
      authToken: null,
      createdAt: new Date(),
    } as any)
    .returning({ id: platforms.id });
  assert.ok(row?.id, `Failed to create platform ${name}`);
  return row.id;
}

async function main() {
  const seed = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
  const createdUserIds: number[] = [];

  console.log("Running integration edge-case storage regressions...");

  try {
    const userA = await seedUser(`edge-a-${seed}@example.com`, "Edge User A");
    const userB = await seedUser(`edge-b-${seed}@example.com`, "Edge User B");
    createdUserIds.push(userA, userB);

    const platformA = await seedPlatform(userA, "discord", `edge-discord-a-${seed}`);
    const platformB = await seedPlatform(userB, "discord", `edge-discord-b-${seed}`);

    const sharedExternalId = `edge-channel-${seed}`;
    const sharedExternalUser = `external-user-${seed}`;

    const [conversationA] = await db
      .insert(conversations)
      .values({
        platformId: platformA,
        externalId: sharedExternalId,
        externalUserId: sharedExternalUser,
        externalUsername: "edge-a",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .returning({ id: conversations.id });
    assert.ok(conversationA?.id, "Failed to create conversationA");

    const [conversationB] = await db
      .insert(conversations)
      .values({
        platformId: platformB,
        externalId: sharedExternalId,
        externalUserId: sharedExternalUser,
        externalUsername: "edge-b",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .returning({ id: conversations.id });
    assert.ok(conversationB?.id, "Failed to create conversationB");

    console.log("Test 1: platform-scoped conversation lookup");
    const scopedA = await storage.getConversationByPlatformAndExternalId(platformA, sharedExternalId);
    const scopedB = await storage.getConversationByPlatformAndExternalId(platformB, sharedExternalId);
    assert.equal(scopedA?.id, conversationA.id, "Expected platform A scoped lookup to return conversationA");
    assert.equal(scopedB?.id, conversationB.id, "Expected platform B scoped lookup to return conversationB");

    console.log("Test 2: platform+external+user scoped conversation lookup");
    const userScoped = await storage.getConversationByPlatformExternalAndUser(
      platformA,
      sharedExternalId,
      sharedExternalUser,
    );
    assert.equal(
      userScoped?.id,
      conversationA.id,
      "Expected platform+external+user scoped lookup to return conversationA",
    );

    console.log("Test 3: conditional claim consume is single-use");
    const [claimRow] = await db
      .insert(integrationClaimCodes)
      .values({
        platformId: platformA,
        workspaceOwnerId: userA,
        platformType: "discord",
        code: `EDGE-${Math.floor(Math.random() * 1_000_000)}`,
        createdByUserId: userA,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        createdAt: new Date(),
      } as any)
      .returning({ id: integrationClaimCodes.id });
    assert.ok(claimRow?.id, "Expected claim row");

    const usedAt = new Date();
    const [consume1, consume2] = await Promise.all([
      storage.consumeIntegrationClaimCodeIfActive(claimRow.id, {
        usedAt,
        usedExternalId: `guild-${seed}-a`,
        usedByPlatformUserId: "claimer-a",
      }),
      storage.consumeIntegrationClaimCodeIfActive(claimRow.id, {
        usedAt,
        usedExternalId: `guild-${seed}-b`,
        usedByPlatformUserId: "claimer-b",
      }),
    ]);

    const consumedCount = [consume1, consume2].filter(Boolean).length;
    assert.equal(consumedCount, 1, "Expected exactly one successful conditional claim consume");

    console.log("All integration edge-case storage regressions passed.");
  } finally {
    if (createdUserIds.length > 0) {
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Integration edge-case regression script failed:", error);
    process.exit(1);
  });
