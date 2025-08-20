import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";
import { db } from "./db";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { initializeAllBots as initializeAllTelegramBots } from "./lib/telegram";
import { initializeAllBots as initializeAllDiscordBots } from "./lib/discord";
import cors from "cors";
import rateLimit from "express-rate-limit";

// Function to hash passwords
const scryptAsync = promisify(scrypt);
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

const app = express();

// Security middleware - CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === "production" 
    ? [process.env.FRONTEND_URL || "https://yourapp.replit.app"] 
    : ["http://localhost:5000", "http://127.0.0.1:5000"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Rate limiting middleware - more generous for normal usage
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "production" ? 1000 : 10000, // Much higher limits
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for static assets in development
    return process.env.NODE_ENV === "development" && !req.path.startsWith('/api');
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 login attempts per 15 minutes should be sufficient
  message: "Too many login attempts, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting
app.use(limiter);
app.use("/api/login", authLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

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
      if (capturedJsonResponse && process.env.NODE_ENV === "development") {
        // Only log response data in development for security
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


(async () => {
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = process.env.NODE_ENV === "production" 
      ? "Internal Server Error" 
      : err.message || "Internal Server Error";

    console.error('Application error:', err.message);
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
    initializeAllTelegramBots()
      .then(() => log('Initialized active Telegram bots'))
      .catch(err => log(`Error initializing Telegram bots: ${err.message}`));
      
    // Initialize any active Discord bots
    initializeAllDiscordBots()
      .then(() => log('Initialized active Discord bots'))
      .catch(err => log(`Error initializing Discord bots: ${err.message}`));
  });
})();
