import { eq } from "drizzle-orm";
import { getStore } from "@/config/store";
import { getDb } from "@/db";
import { storeCatalogs } from "@/db/schema";

/** Only the materialized publication is selected on a public read. */
export async function readPublication() {
  const db = await getDb();
  const [row] = await db.select({ catalog: storeCatalogs.published }).from(storeCatalogs)
    .where(eq(storeCatalogs.storeId, getStore().id));
  if (!row) throw new Error("Store catalog has not been initialized");
  return row.catalog;
}
