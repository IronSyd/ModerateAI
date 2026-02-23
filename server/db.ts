import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres';
import { Pool as NodePgPool } from 'pg';
import ws from "ws";
import * as schema from "@shared/schema";

// Add common local hostnames. `db` is the default service name used in docker-compose setups.
const LOCAL_DB_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "db"]);

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const connectionString = process.env.DATABASE_URL;
let hostname = "";
try {
  hostname = new URL(connectionString).hostname;
} catch {
  hostname = "";
}

const useLocalPgDriver = LOCAL_DB_HOSTS.has(hostname);

// Use Neon serverless driver for remote Neon databases, and native pg for local development.
if (!useLocalPgDriver) {
  neonConfig.webSocketConstructor = ws;
}

export const pool = useLocalPgDriver
  ? new NodePgPool({ connectionString })
  : new NeonPool({ connectionString });

export const db = useLocalPgDriver
  ? drizzleNodePg(pool as NodePgPool, { schema })
  : drizzleNeon({ client: pool as NeonPool, schema });
