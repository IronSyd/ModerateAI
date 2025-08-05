import { db } from "./db";
import { users, platforms } from "@shared/schema";
import crypto from "crypto";
import { eq } from "drizzle-orm";

async function setupAdminAccount() {
  console.log("Setting up admin account...");

  const username = "ModerateAI";
  const password = "ModerateAI007#";
  const email = "admin@moderateai.com"; // We'll need the actual email from the user

  // Check if admin already exists
  const existingAdmin = await db
    .select()
    .from(users)
    .where(eq(users.username, username));

  if (existingAdmin.length > 0) {
    console.log("Admin user already exists, updating...");
    
    // Update the password
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto
      .scryptSync(password, salt, 64)
      .toString("hex");

    await db
      .update(users)
      .set({
        passwordHash: hash,
        passwordSalt: salt,
        email: email,
        fullName: "ModerateAI Admin",
        isActive: true,
        requireTwoFactor: true,
      })
      .where(eq(users.username, username));

    console.log("Admin user updated successfully");
  } else {
    // Create new admin user
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto
      .scryptSync(password, salt, 64)
      .toString("hex");

    const [newUser] = await db
      .insert(users)
      .values({
        username: username,
        email: email,
        fullName: "ModerateAI Admin",
        password: password, // Keep original password field for compatibility
        passwordHash: hash,
        passwordSalt: salt,
        isActive: true,
        requireTwoFactor: true,
      })
      .returning();

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

  process.exit(0);
}

setupAdminAccount().catch((err) => {
  console.error("Error setting up admin account:", err);
  process.exit(1);
});