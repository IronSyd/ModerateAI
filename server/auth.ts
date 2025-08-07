import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual, scryptSync } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as UserType } from "@shared/schema";
import createMemoryStore from "memorystore";

declare global {
  namespace Express {
    interface User extends UserType {}
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  if (!stored || typeof stored !== 'string') {
    console.error('Invalid stored password format:', stored);
    return false;
  }
  
  try {
    const [hashed, salt] = stored.split(".");
    if (!hashed || !salt) {
      console.error('Invalid password format, missing hash or salt');
      return false;
    }
    
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error('Error comparing passwords:', error);
    return false;
  }
}

export function setupAuth(app: Express) {
  // Create MemoryStore for session storage
  const MemoryStore = createMemoryStore(session);
  const sessionStore = new MemoryStore({
    checkPeriod: 86400000, // prune expired entries every 24h
  });

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "moderation-ai-dev-secret",
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Email-only authentication - no password required
  passport.use(
    new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
      try {
        console.log(`Authenticating user: ${email}`);
        
        // Check if email is whitelisted first
        const isWhitelisted = await storage.isEmailWhitelisted(email);
        if (!isWhitelisted) {
          console.log(`Email not whitelisted: ${email}`);
          return done(null, false, { message: "Email not authorized" });
        }
        
        // Find user by email
        const user = await storage.getUserByEmail(email);
        if (!user) {
          console.log(`User not found: ${email}`);
          return done(null, false, { message: "User not found" });
        }
        
        console.log(`User ${email} authenticated successfully`);
        return done(null, user);
      } catch (error) {
        console.error(`Authentication error for ${email}:`, error);
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });



  app.post("/api/login", (req: Request, res: Response, next: NextFunction) => {
    console.log("Login attempt for:", req.body.email);
    
    if (!req.body.email) {
      console.error("Missing email");
      return res.status(400).json({ message: "Email is required" });
    }
    
    passport.authenticate("local", (err: Error, user: UserType, info: { message: string }) => {
      if (err) {
        console.error("Login error:", err);
        return next(err);
      }
      
      if (!user) {
        console.log("Login failed - Invalid credentials");
        console.log("Login info:", info);
        return res.status(401).json({ message: info?.message || "Authentication failed" });
      }
      
      // Direct login without 2FA
      req.login(user, (loginErr) => {
        if (loginErr) {
          console.error("Login session error:", loginErr);
          return next(loginErr);
        }
        
        console.log(`Login successful for user ${user.id}, session ID: ${req.sessionID}`);
        console.log(`Session cookie set: ${JSON.stringify(req.session)}`);
        
        // Return user without sensitive information
        const safeUser = {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role
        };
        
        return res.status(200).json(safeUser);
      });
    })(req, res, next);
  });

  // 2FA endpoint removed - authentication now uses username/password only

  app.post("/api/logout", (req: Request, res: Response) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ message: "Logout failed" });
      res.status(200).json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/user", (req: Request, res: Response) => {
    console.log(`GET /api/user - isAuthenticated: ${req.isAuthenticated()}, sessionID: ${req.sessionID}, session:`, req.session);
    
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    console.log(`User found in session: ${JSON.stringify(req.user)}`);
    res.status(200).json(req.user);
  });
}