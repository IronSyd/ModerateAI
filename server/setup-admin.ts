import "dotenv/config";
import { db } from "./db";
import { users, platforms } from "@shared/schema";
import { eq, or } from "drizzle-orm";

async function setupAdminAccount() {
  console.log("Setting up admin account...");

  const email = String(process.env.OWNER_EMAIL || process.env.ADMIN_EMAIL || "admin@moderate.ai")
    .toLowerCase()
    .trim();
  const fullName = String(process.env.OWNER_NAME || "ModerateAI Admin").trim() || "ModerateAI Admin";

  // Support migrating older default emails that may have been used previously.
  const legacyEmails = new Set([
    "admin@moderateai.com", // previous default (case-insensitive)
    "admin@ModerateAI.com",
  ].map((value) => value.toLowerCase()));

  // Check if admin already exists
  const existingAdmin = await db
    .select()
    .from(users)
    .where(eq(users.email, email));

  if (existingAdmin.length > 0) {
    console.log("Admin user already exists, updating...");

    await db
      .update(users)
      .set({
        email,
        fullName,
        role: "owner",
        isActive: true,
        requireTwoFactor: false,
      })
      .where(eq(users.email, email));

    console.log("Admin user updated successfully");
  } else {
    // Migrate legacy admin email (if present) to the desired owner email.
    const legacyAdmin = await db
      .select()
      .from(users)
      .where(or(eq(users.role, "owner"), eq(users.role, "admin")));

    const legacyMatch = legacyAdmin.find((u) => legacyEmails.has(String(u.email).toLowerCase()));

    if (legacyMatch) {
      console.log(`Migrating legacy admin email (${legacyMatch.email}) -> (${email})...`);

      await db
        .update(users)
        .set({
          email,
          fullName,
          role: "owner",
          isActive: true,
          requireTwoFactor: false,
        })
        .where(eq(users.id, legacyMatch.id));

      console.log("Admin user migrated successfully");
    } else {
      // Create new admin user
      const insertedUsers = await db
        .insert(users)
        .values({
          email,
          fullName,
          role: "owner",
          isActive: true,
          requireTwoFactor: false,
        })
        .returning();

      const newUser = Array.isArray(insertedUsers) ? insertedUsers[0] : (insertedUsers as any)?.rows?.[0];
      if (!newUser) {
        throw new Error("Failed to create admin user");
      }

      console.log("Admin user created successfully");

      // Create initial platforms for the admin
      await db.insert(platforms).values([
        {
          userId: newUser.id,
          type: "telegram",
          name: "ModerateAI Telegram",
          status: "setup_required",
        },
        {
          userId: newUser.id,
          type: "discord",
          name: "ModerateAI Discord",
          status: "setup_required",
        },
        {
          userId: newUser.id,
          type: "website",
          name: "ModerateAI Website",
          status: "active",
        },
      ]);

      console.log("Default platforms created for admin user");
    }
  }

  process.exit(0);
}

setupAdminAccount().catch((err) => {
  console.error("Error setting up admin account:", err);
  process.exit(1);
});

