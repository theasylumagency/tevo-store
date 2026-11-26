import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { getIndex } from "@/lib/catalog";

/** For uptime checks and the Docker healthcheck. */
export async function GET() {
  try {
    const [db, { visible, catalog }] = await Promise.all([getDb(), getIndex()]);
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, products: visible.length, catalog: catalog.generated_at });
  } catch (e) {
    console.error("health check failed", e);
    return Response.json({ ok: false }, { status: 503 });
  }
}
