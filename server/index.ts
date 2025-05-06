import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";
import { db } from "./db";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { initializeAllBots } from "./lib/telegram";

// Function to hash passwords
const scryptAsync = promisify(scrypt);
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Initialize database with demo data
async function initializeDemoData() {
  try {
    // Check if we need to recreate the demo user with properly hashed password
    // This is a one-time fix for the demo environment
    const recreateDemo = process.env.RECREATE_DEMO === "true" || true; // Force recreation for now
    
    // Check if demo user exists
    let demoUser = await storage.getUserByUsername("demo");
    
    if (recreateDemo && demoUser) {
      // Update the existing demo user's password directly
      log("Fixing demo user password");
      
      // Create a properly hashed password
      const hashedPassword = await hashPassword("demo123");
      
      // Update the user directly through storage
      await db.update(users)
        .set({ password: hashedPassword })
        .where(eq(users.username, "demo"));
      
      log("Demo user password updated");
    }
    
    if (!demoUser) {
      log("Creating demo user");
      const hashedPassword = await hashPassword("demo123");
      demoUser = await storage.createUser({
        username: "demo",
        password: hashedPassword,
        email: "demo@example.com",
        fullName: "Demo User",
        role: "admin"
      });
      
      // Create default AI configuration
      await storage.createAiConfiguration({
        name: "Default Configuration",
        userId: demoUser.id,
        responseStyle: 75,
        responseLength: 40,
        moderationStrictness: 50,
        isActive: true,
        model: "gpt-4o",
        systemPrompt: "You are a helpful customer support assistant. Be concise and professional."
      });
      
      // Create default website platform
      await storage.createPlatform({
        name: "Website Chat",
        type: "website",
        status: "active",
        userId: demoUser.id,
        config: {},
        authToken: null
      });
      
      log("Demo user created successfully");
    } else {
      log("Demo user already exists");
    }
    
    // Always ensure Telegram platform exists for the demo user
    if (demoUser) {
      // Check if Telegram platform exists for this user
      const platforms = await storage.getPlatformsByUserId(demoUser.id);
      const telegramPlatform = platforms.find(p => p.type === "telegram");
      
      if (!telegramPlatform) {
        log("Creating Telegram platform for existing user");
        
        // Create Telegram platform
        await storage.createPlatform({
          name: "Telegram Bot",
          type: "telegram",
          status: "not_connected",
          userId: demoUser.id,
          config: {
            welcomeMessage: "Hello! I'm your AI assistant. How can I help you today?",
            groupMode: true,
            botCommands: [
              { command: "help", description: "Show help information" },
              { command: "about", description: "About this bot" }
            ]
          },
          authToken: null
        });
        
        log("Telegram platform created successfully");
      } else {
        log("Telegram platform already exists");
      }
    }
  } catch (error: any) {
    log(`Error initializing demo data: ${error.message}`);
  }
}

(async () => {
  // Initialize demo data before registering routes
  await initializeDemoData();
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // Initialize any active Telegram bots
    initializeAllBots()
      .then(() => log('Initialized active Telegram bots'))
      .catch(err => log(`Error initializing Telegram bots: ${err.message}`));
  });
})();
