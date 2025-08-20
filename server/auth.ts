import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual, scryptSync } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as UserType } from "@shared/schema";
import connectPg from "connect-pg-simple";

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
    console.error('Invalid stored password format');
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
  } catch (error: any) {
    console.error('Error comparing passwords:', error?.message || 'Unknown error');
    return false;
  }
}

export function setupAuth(app: Express) {
  // Enforce SESSION_SECRET environment variable
  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET environment variable is required for production");
  }

  // Create database-backed session storage for production reliability
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: 24 * 60 * 60 * 1000, // 24 hours
    tableName: "sessions"
  });

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // HTTPS only in production
      sameSite: "strict" // CSRF protection
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Email-only authentication - no password required
  passport.use(
    new LocalStrategy({ usernameField: 'email', passwordField: 'email' }, async (email, password, done) => {
      try {
        // Authentication attempt (email redacted for security)
        
        // Check if email is whitelisted first
        const isWhitelisted = await storage.isEmailWhitelisted(email);
        if (!isWhitelisted) {
          return done(null, false, { message: "Email not authorized" });
        }
        
        // Find user by email
        const user = await storage.getUserByEmail(email);
        if (!user) {
          return done(null, false, { message: "User not found" });
        }
        
        // Authentication successful
        return done(null, user);
      } catch (error) {
        console.error('Authentication error:', error.message);
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
    } catch (error: any) {
      done(error, null);
    }
  });



  app.post("/api/login", (req: Request, res: Response, next: NextFunction) => {
    // Login attempt logged
    
    if (!req.body.email) {
      console.error("Missing email");
      return res.status(400).json({ message: "Email is required" });
    }
    
    passport.authenticate("local", (err: Error, user: UserType, info: { message: string }) => {
      if (err) {
        console.error("Login error:", err.message);
        return next(err);
      }
      
      if (!user) {
        console.log("Login failed - Invalid credentials");
        return res.status(401).json({ message: info?.message || "Authentication failed" });
      }
      
      // Direct login without 2FA
      req.login(user, (loginErr) => {
        if (loginErr) {
          console.error("Login session error:", loginErr.message);
          return next(loginErr);
        }
        
        console.log(`Login successful for user ${user.id}`);
        
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
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    res.status(200).json(req.user);
  });
}