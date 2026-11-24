// Applies drizzle/ migrations to DATABASE_URL (postgres://…). Run on deploy: npm run db:migrate
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const url = process.env.DATABASE_URL;
if (!url || !url.startsWith("postgres")) {
  console.error("DATABASE_URL must be a postgres:// URL (pglite migrates itself on first use)");
  process.exit(1);
}
const pool = new pg.Pool({ connectionString: url });
await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
await pool.end();
console.log("migrations applied");
