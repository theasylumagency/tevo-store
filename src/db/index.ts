import "server-only";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import * as schema from "./schema";

/**
 * DATABASE_URL=postgres://…  → node-postgres (production, OVH)
 * DATABASE_URL=pglite:./.data/db (or unset) → embedded Postgres for local dev, migrated on first use
 */
type DB = import("drizzle-orm/node-postgres").NodePgDatabase<typeof schema>;

const g = globalThis as unknown as { __db?: Promise<DB> };

async function connect(): Promise<DB> {
  const url = process.env.DATABASE_URL ?? "pglite:./.data/db";
  const migrationsFolder = path.join(/*turbopackIgnore: true*/ process.cwd(), "drizzle");
  if (url.startsWith("pglite:")) {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const dir = url.slice("pglite:".length);
    let client: InstanceType<typeof PGlite>;
    if (dir === "memory") client = new PGlite();
    else {
      const abs = path.resolve(/*turbopackIgnore: true*/ dir);
      await mkdir(abs, { recursive: true });
      client = new PGlite(abs);
    }
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder });
    return db as unknown as DB;
  }
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const db = drizzle(new Pool({ connectionString: url, max: 10 }), { schema });
  if (process.env.DB_MIGRATE_ON_START === "1") {
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    await migrate(db, { migrationsFolder });
  }
  return db;
}

export function getDb(): Promise<DB> {
  g.__db ??= connect().catch((e) => {
    g.__db = undefined;
    throw e;
  });
  return g.__db;
}

export { schema };
