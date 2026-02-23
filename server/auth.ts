import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as UserType } from "@shared/schema";
import connectPg from "connect-pg-simple";
import { getWorkspaceOwnerId, getWorkspaceRole } from "./workspace";
import { normalizePlan, normalizePlanStatus } from "./billing/entitlements";
import { recordOpsEvent } from "./lib/ops-monitor";

declare global {
  namespace Express {
    interface User extends UserType {}
  }
}

const scryptAsync = promisify(scrypt);
const SESSION_TTL_SECONDS = 24 * 60 * 60;
const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;

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

function getConfiguredOwnerEmail(): string {
  return String(process.env.OWNER_EMAIL || process.env.ADMIN_EMAIL || "admin@moderateai.net")
    .toLowerCase()
    .trim();
}

function isConfiguredOwnerEmail(email: string | null | undefined): boolean {
  const normalized = String(email ?? "").toLowerCase().trim();
  return normalized.length > 0 && normalized === getConfiguredOwnerEmail();
}

async function ensureOwnerIdentity(user: UserType): Promise<UserType> {
  if (!isConfiguredOwnerEmail(user.email)) return user;

  const patch: Partial<UserType> & {
    workspaceOwnerId?: number | null;
    workspaceRole?: string;
    planSelectedAt?: Date | null;
    planUpdatedAt?: Date;
  } = {};

  if (user.role !== "owner") patch.role = "owner";
  if ((user as any).workspaceOwnerId !== null) patch.workspaceOwnerId = null;
  if ((user as any).workspaceRole !== "admin") patch.workspaceRole = "admin";

  // Owner account should never be blocked by onboarding tier-selection flow.
  if (!(user as any).planSelectedAt) patch.planSelectedAt = new Date();
  if (Object.keys(patch).length > 0) patch.planUpdatedAt = new Date();

  if (Object.keys(patch).length === 0) return user;

  const updated = await storage.updateUser(user.id, patch as any);
  return (updated ?? user) as UserType;
}

export async function toSafeUser(user: UserType) {
  const workspaceOwnerId = (user as any).workspaceOwnerId ?? null;
  const workspaceRole = getWorkspaceRole(user);
  const effectiveOwnerId = getWorkspaceOwnerId(user);

  let billingUser: UserType = user;
  if (effectiveOwnerId !== user.id) {
    const owner = await storage.getUser(effectiveOwnerId);
    if (owner) billingUser = owner as any;
  }

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    mustChangePassword: (user as any).mustChangePassword ?? false,
    temporaryPasswordExpiresAt: (user as any).temporaryPasswordExpiresAt ?? null,
    workspaceOwnerId,
    workspaceRole,
    plan: (billingUser as any).plan ?? "free",
    planStatus: (billingUser as any).planStatus ?? "active",
    trialStartedAt: (billingUser as any).trialStartedAt ?? null,
    trialEndsAt: (billingUser as any).trialEndsAt ?? null,
    planSelectedAt: (billingUser as any).planSelectedAt ?? null,
  };
}

function isBillingExemptRole(role: string | undefined): boolean {
  return role === "owner" || role === "admin";
}

function parseBooleanEnv(value: string | undefined): boolean | null {
  if (value === undefined) return null;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return null;
}

function getSessionCookieSecureSetting(): boolean | "auto" {
  const override = parseBooleanEnv(process.env.SESSION_COOKIE_SECURE);
  if (override !== null) return override;

  // Safer default for mixed environments:
  // - local HTTP keeps session cookies working
  // - HTTPS/proxied deployments still get secure cookies
  return "auto";
}

async function ensureWorkspaceBillingAccess(user: UserType): Promise<{ allowed: boolean; message?: string }> {
  const effectiveOwnerId = getWorkspaceOwnerId(user);
  const owner = effectiveOwnerId === user.id ? (user as any) : ((await storage.getUser(effectiveOwnerId)) as any);
  if (!owner) return { allowed: true };

  // Internal accounts are never subject to billing suspension.
  if (isBillingExemptRole(owner.role)) return { allowed: true };

  const now = new Date();

  if ((owner as any).billingSuspendedAt) {
    return { allowed: false, message: "Account suspended due to billing. Please contact support." };
  }

  const plan = normalizePlan((owner as any).plan);
  if (plan === "free") return { allowed: true };

  const paidThroughAt = ((owner as any).paidThroughAt ?? null) as Date | null;
  if (paidThroughAt && paidThroughAt.getTime() > now.getTime()) {
    return { allowed: true };
  }

  const planStatus = normalizePlanStatus((owner as any).planStatus);
  const trialEndsAt = ((owner as any).trialEndsAt ?? null) as Date | null;
  if (planStatus === "trialing" && trialEndsAt && trialEndsAt.getTime() > now.getTime()) {
    return { allowed: true };
  }

  // Auto-suspend on trial/subscription expiration unless manually marked as paid.
  const reason = planStatus === "trialing" ? "trial_expired" : "subscription_expired";
  await storage.updateUser(
    owner.id,
    {
      billingSuspendedAt: now,
      billingSuspendedReason: reason,
      billingSuspendedBy: null,
      planStatus: "past_due",
    } as any,
  );

  return {
    allowed: false,
    message:
      planStatus === "trialing"
        ? "Your free trial has ended. Please contact support to continue."
        : "Your subscription has expired. Please contact support to continue.",
  };
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
    ttl: SESSION_TTL_SECONDS, // connect-pg-simple expects seconds
    tableName: "sessions"
  });
  sessionStore.on("error", (error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Session store error:", message);
    recordOpsEvent("AUTH_SESSION_ERROR", {
      stage: "session_store",
      message,
    });
  });

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true, // refresh cookie expiry while the user is active
    store: sessionStore,
    cookie: {
      maxAge: SESSION_TTL_MS, // 24 hours
      httpOnly: true,
      secure: getSessionCookieSecureSetting(),
      sameSite: "strict" // CSRF protection
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Email + password authentication
  passport.use(
    new LocalStrategy({ usernameField: "email", passwordField: "password" }, async (email, password, done) => {
      try {
        const normalizedEmail = String(email).toLowerCase().trim();
        const suppliedPassword = String(password ?? "");

        if (!normalizedEmail || !suppliedPassword) {
          return done(null, false, { message: "Email and password are required" });
        }

        // Find user by email
        let user = await storage.getUserByEmail(normalizedEmail);
        if (!user) {
          return done(null, false, { message: "Invalid email or password" });
        }

        user = await ensureOwnerIdentity(user as any);

        if ((user as any).isBanned) {
          return done(null, false, { message: "Account is banned" });
        }

        if (!user.isActive) {
          return done(null, false, { message: "Account is disabled" });
        }

        // Require a password to sign in
        if (!user.password) {
          return done(null, false, { message: "Please create an account to set a password" });
        }

        const isMatch = await comparePasswords(suppliedPassword, user.password);
        if (!isMatch) {
          return done(null, false, { message: "Invalid email or password" });
        }

        if ((user as any).mustChangePassword) {
          const expiresAtRaw = (user as any).temporaryPasswordExpiresAt;
          const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;
          const isExpired =
            !expiresAt ||
            Number.isNaN(expiresAt.getTime()) ||
            expiresAt.getTime() <= Date.now();

          if (isExpired) {
            return done(null, false, {
              message: "Temporary password expired. Contact your admin for a new reset.",
            });
          }
        }

        const billing = await ensureWorkspaceBillingAccess(user as any);
        if (!billing.allowed) {
          return done(null, false, { message: billing.message || "Account suspended due to billing" });
        }
        
        // Authentication successful
        return done(null, user);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Authentication error:', errorMessage);
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      let user = await storage.getUser(id);
      if (!user) return done(null, false);
      user = await ensureOwnerIdentity(user as any);
      if (!user.isActive || (user as any).isBanned) return done(null, false);
      const billing = await ensureWorkspaceBillingAccess(user as any);
      if (!billing.allowed) return done(null, false);
      return done(null, user);
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      recordOpsEvent("AUTH_SESSION_ERROR", {
        stage: "deserialize_user",
        message,
      });
      done(error, null);
    }
  });



  app.post("/api/login", (req: Request, res: Response, next: NextFunction) => {
    // Login attempt logged
    
    if (!req.body.email || !req.body.password) {
      return res.status(400).json({ message: "Email and password are required" });
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
          recordOpsEvent("AUTH_SESSION_ERROR", {
            stage: "req_login",
            message: loginErr.message,
            userId: user.id,
          });
          return next(loginErr);
        }
        
        console.log(`Login successful for user ${user.id}`);

        (async () => {
          try {
            const safe = await toSafeUser(user);
            return res.status(200).json(safe);
          } catch (safeError) {
            return next(safeError as any);
          }
        })();
      });
    })(req, res, next);
  });

  app.post("/api/signup", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const email = String(req.body.email || "").toLowerCase().trim();
      const fullName = String(req.body.fullName || "").trim();
      const password = String(req.body.password || "");

      if (!email || !fullName || !password) {
        return res.status(400).json({ message: "Full name, email, and password are required" });
      }

      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }

      const hashed = await hashPassword(password);

      const existing = await storage.getUserByEmail(email);
      let user: UserType | undefined;

      if (existing) {
        const shouldBeOwner = isConfiguredOwnerEmail(existing.email);
        if ((existing as any).isBanned) {
          return res.status(403).json({ message: "Account is banned" });
        }

        if (existing.password) {
          return res.status(409).json({ message: "An account with this email already exists" });
        }

        // Legacy accounts may exist without a password; allow completing signup.
        user = await storage.updateUser(existing.id, {
          fullName: fullName || existing.fullName,
          password: hashed,
          isActive: true,
          role: shouldBeOwner ? "owner" : existing.role,
          workspaceOwnerId: shouldBeOwner ? null : (existing as any).workspaceOwnerId ?? null,
          workspaceRole: shouldBeOwner ? "admin" : (existing as any).workspaceRole ?? "admin",
          planSelectedAt: shouldBeOwner ? (existing as any).planSelectedAt ?? new Date() : (existing as any).planSelectedAt ?? null,
          planUpdatedAt: new Date(),
        });

        if (!user) {
          return res.status(500).json({ message: "Failed to complete signup" });
        }
      } else {
        const shouldBeOwner = isConfiguredOwnerEmail(email);
        user = await storage.createUser({
          email,
          fullName,
          password: hashed,
          role: shouldBeOwner ? "owner" : "user",
        });
        if (shouldBeOwner) {
          user = await ensureOwnerIdentity(user as any);
        }
      }

      // Ensure new users have default platform records.
      const existingPlatforms = await storage.getPlatformsByUserId(user.id);
      if (!existingPlatforms || existingPlatforms.length === 0) {
        await storage.createPlatform({
          userId: user.id,
          type: "telegram",
          name: "ModerateAI Telegram",
          status: "setup_required",
          config: null,
          authToken: null,
        });
        await storage.createPlatform({
          userId: user.id,
          type: "discord",
          name: "ModerateAI Discord",
          status: "setup_required",
          config: null,
          authToken: null,
        });
        await storage.createPlatform({
          userId: user.id,
          type: "website",
          name: "ModerateAI Website",
          status: "setup_required",
          config: null,
          authToken: null,
        });
      }

      // Do not auto-login on signup; user should sign in explicitly.
      return res.status(201).json(await toSafeUser(user));
    } catch (error) {
      return next(error);
    }
  });

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
    
    (async () => {
      const safe = await toSafeUser(req.user as any);
      res.status(200).json(safe);
    })().catch(() => res.status(500).json({ message: "Failed to load user" }));
  });
}

