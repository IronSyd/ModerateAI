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

const isNeonHost = hostname.includes("neon.tech");
const useNeonDriver = isNeonHost;

// Only enable Neon websocket config when actually using Neon.
if (useNeonDriver) {
  neonConfig.webSocketConstructor = ws;
}

export const pool = useNeonDriver
  ? new NeonPool({ connectionString })
  : new NodePgPool({ connectionString });

export const db = useNeonDriver
  ? drizzleNeon({ client: pool as NeonPool, schema })
  : drizzleNodePg(pool as NodePgPool, { schema });
