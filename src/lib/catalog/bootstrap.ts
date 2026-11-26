// Imported by the database initializer. A store with a publication can restart with its input offline.
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import type { StoreDatabase } from "@/db";
import { storeCatalogs } from "@/db/schema";
import { getStore } from "@/config/store";
import { prepareCatalog, validateImport } from "./publication";
import { createCatalogSource } from "./source";

export async function readCatalogInput() {
  const source = validateImport(await createCatalogSource().load());
  const digest = createHash("sha256").update(JSON.stringify(source)).digest("hex");
  return { source, digest };
}

export async function bootstrapCatalog(db: StoreDatabase) {
  const storeId = getStore().id;
  const [existing] = await db.select({ id: storeCatalogs.storeId }).from(storeCatalogs).where(eq(storeCatalogs.storeId, storeId));
  if (existing) return;
  const input = await readCatalogInput();
  const publication = prepareCatalog(input.source, new Map(), null, input.source.generated_at);
  await db.insert(storeCatalogs).values({ storeId, ...input, ...publication }).onConflictDoNothing();
}
