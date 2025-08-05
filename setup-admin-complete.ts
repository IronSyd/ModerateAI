import { db } from "./server/db.js";
import { users, platforms } from "./shared/schema.js";
import { scryptSync, randomBytes } from "crypto";
import { eq, sql } from "drizzle-orm";

async function setupAdminAccount() {
  console.log("Setting up admin account...");

  const username = "ModerateAI";
  const password = "ModerateAI007#";
  const email = process.env.ADMIN_EMAIL || "admin@moderateai.com"; // Will be set via environment variable

  try {
    // First, add the new columns if they don't exist
    console.log("Updating database schema...");
    
    // Add passwordHash column
    await db.execute(sql`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS password_hash TEXT
    `);
    
    // Add passwordSalt column
    await db.execute(sql`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS password_salt TEXT
    `);
    
    // Add isActive column
    await db.execute(sql`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true
    `);
    
    // Add requireTwoFactor column
    await db.execute(sql`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS require_two_factor BOOLEAN DEFAULT false
    `);
    
    // Add twoFactorCode column
    await db.execute(sql`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS two_factor_code TEXT
    `);
    
    // Add twoFactorCodeExpiry column
    await db.execute(sql`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS two_factor_code_expiry TIMESTAMP
    `);
    
    console.log("Database schema updated successfully!");

    // Check if admin already exists
    const existingAdmin = await db
      .select()
      .from(users)
      .where(eq(users.username, username));

    const salt = randomBytes(16).toString("hex");
    const hash = scryptSync(password, salt, 64).toString("hex");

    if (existingAdmin.length > 0) {
      console.log("Admin user already exists, updating...");
      
      await db
        .update(users)
        .set({
          password: password, // Keep for compatibility
          passwordHash: hash,
          passwordSalt: salt,
          email: email,
          fullName: "ModerateAI Admin",
          isActive: true,
          requireTwoFactor: true,
          role: "admin",
        })
        .where(eq(users.username, username));

      console.log("Admin user updated successfully");
      console.log(`Username: ${username}`);
      console.log(`Password: ${password}`);
      console.log(`2FA Email: ${email}`);
    } else {
      // Create new admin user
      const [newUser] = await db
        .insert(users)
        .values({
          username: username,
          email: email,
          fullName: "ModerateAI Admin",
          password: password, // Keep for compatibility
          passwordHash: hash,
          passwordSalt: salt,
          isActive: true,
          requireTwoFactor: true,
          role: "admin",
        })
        .returning();

      console.log("Admin user created successfully");
      console.log(`Username: ${username}`);
      console.log(`Password: ${password}`);
      console.log(`2FA Email: ${email}`);

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

    // Remove demo user if it exists
    const demoUser = await db
      .select()
      .from(users)
      .where(eq(users.username, "demo"));

    if (demoUser.length > 0) {
      await db.delete(users).where(eq(users.username, "demo"));
      console.log("Demo user removed");
    }

  } catch (error) {
    console.error("Error setting up admin account:", error);
    throw error;
  } finally {
    process.exit(0);
  }
}

setupAdminAccount().catch((err) => {
  console.error("Failed to setup admin account:", err);
  process.exit(1);
});