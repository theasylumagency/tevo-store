import "server-only";
import { and, desc, eq, isNull, lt } from "drizzle-orm";
import { getDb, type StoreDatabase } from "@/db";
import { catalogEdits, catalogHistory, priceHistory, storeCatalogs } from "@/db/schema";
import { getStore } from "@/config/store";
import { readCatalogInput } from "./bootstrap";
import { CatalogInputError, prepareCatalog, prepareProduct, type PriceRule, type ProductEdits } from "./publication";
import { samePrice } from "./pricing";
import type { Product } from "./types";

type Tx = Parameters<Parameters<StoreDatabase["transaction"]>[0]>[0];
type StoreRow = typeof storeCatalogs.$inferSelect;
const forStore = () => eq(storeCatalogs.storeId, getStore().id);
const editKey = (id: string) => and(eq(catalogEdits.storeId, getStore().id), eq(catalogEdits.productId, id));
const historyKey = (id: string | null) => and(eq(catalogHistory.storeId, getStore().id),
  id === null ? isNull(catalogHistory.productId) : eq(catalogHistory.productId, id));

export async function lockedCatalog(tx: Tx) {
  const [row] = await tx.select().from(storeCatalogs).where(forStore()).for("update");
  if (!row) throw new Error("Missing store catalog");
  return row;
}

export function nextCatalogVersion(row: StoreRow) {
  return new Date(Math.max(Date.now(), Date.parse(row.published.generated_at) + 1)).toISOString();
}

async function rebuild(tx: Tx, row: StoreRow, source = row.source, globalRule = row.globalRule) {
  const overrides = await tx.select({ id: catalogEdits.productId, live: catalogEdits.live }).from(catalogEdits)
    .where(eq(catalogEdits.storeId, row.storeId));
  return prepareCatalog(source, new Map(overrides.map(o => [o.id, o.live])), globalRule, nextCatalogVersion(row));
}

async function recordPrices(tx: Tx, storeId: string, before: Product[], after: Product[],
  reason: typeof priceHistory.$inferInsert.reason) {
  const previous = new Map(before.map(p => [p.id, p]));
  const changes: (typeof priceHistory.$inferInsert)[] = [];
  for (const product of after) {
    const old = previous.get(product.id);
    if (!samePrice(old?.price, product.price)) changes.push({ storeId, productId: product.id,
      name: product.name, reason, before: old?.price ?? null, after: product.price });
    previous.delete(product.id);
  }
  for (const removed of previous.values()) changes.push({ storeId, productId: removed.id,
    name: removed.name, reason, before: removed.price, after: null });
  for (let i = 0; i < changes.length; i += 500) {
    await tx.insert(priceHistory).values(changes.slice(i, i + 500));
  }
}

export async function importCatalog() {
  const db = await getDb();
  const [observed] = await db.select({ digest: storeCatalogs.digest }).from(storeCatalogs).where(forStore());
  const input = await readCatalogInput();
  return db.transaction(async tx => {
    const row = await lockedCatalog(tx);
    if (input.digest === row.digest) return false;
    if (observed.digest !== row.digest) throw new CatalogInputError("პარალელურად დასრულდა სხვა იმპორტი. თავიდან გაუშვი განახლება.");
    const publication = await rebuild(tx, row, input.source);
    await recordPrices(tx, row.storeId, row.published.products, publication.published.products, "import");
    await tx.update(storeCatalogs).set({ ...input, ...publication, policyVersion: row.policyVersion + 1 }).where(forStore());
    return true;
  });
}

function checkRevision(expected: string, actual: string) {
  if (expected !== actual) throw new CatalogInputError("ვერსია შეიცვალა. განაახლე გვერდი და გადაამოწმე ცვლილებები.");
}

export async function setGlobalRule(rule: PriceRule | null, expected: string, actor: string) {
  const db = await getDb();
  await db.transaction(async tx => {
    const row = await lockedCatalog(tx);
    checkRevision(expected, row.published.generated_at);
    if (rule?.kind === row.globalRule?.kind && rule?.amount === row.globalRule?.amount) return;
    const publication = await rebuild(tx, row, row.source, rule);
    await recordPrices(tx, row.storeId, row.published.products, publication.published.products, "global");
    await tx.update(storeCatalogs).set({ ...publication, globalRule: rule, policyVersion: row.policyVersion + 1 }).where(forStore());
    await tx.insert(catalogHistory).values({ storeId: row.storeId, edits: rule ? { rule } : {}, actor });
  });
}

export async function adminCatalog() {
  const db = await getDb();
  const [row] = await db.select().from(storeCatalogs).where(forStore());
  const edits = await db.select().from(catalogEdits).where(eq(catalogEdits.storeId, row.storeId));
  return { row, edits: new Map(edits.map(e => [e.productId, e])) };
}

export async function adminPricing() {
  const db = await getDb();
  const [row] = await db.select().from(storeCatalogs).where(forStore());
  const prices = await db.select().from(catalogHistory).where(historyKey(null)).orderBy(desc(catalogHistory.id)).limit(10);
  return { row, prices };
}

export async function publishedPriceHistory(productId?: string, beforeId?: number) {
  const db = await getDb();
  return db.select().from(priceHistory).where(and(eq(priceHistory.storeId, getStore().id),
    productId ? eq(priceHistory.productId, productId) : undefined,
    beforeId ? lt(priceHistory.id, beforeId) : undefined)).orderBy(desc(priceHistory.id)).limit(31);
}

export async function editorProduct(id: string) {
  const db = await getDb();
  // A single snapshot keeps the displayed source, publication and edit token consistent.
  return db.transaction(async tx => {
    const [row] = await tx.select().from(storeCatalogs).where(forStore()).for("share");
    const source = row.source.products.find(p => p.id === id);
    const published = row.published.products.find(p => p.id === id);
    if (!source || !published) return null;
    const [edit] = await tx.select().from(catalogEdits).where(editKey(id));
    const history = await tx.select().from(catalogHistory).where(historyKey(id)).orderBy(desc(catalogHistory.id));
    return { source, published, applied: row.pricing[id], globalRule: row.globalRule, edit, history,
      token: row.policyVersion + "/" + (edit?.revision ?? 0) };
  });
}

type Change = { type: "save"; edits: ProductEdits } | { type: "publish" } | { type: "restore"; id: number };

function snapshot({ name, subtitle, features, description, price }: Product) {
  return { name, subtitle, features, description, price };
}

export async function recordProductVersion(tx: Tx, storeId: string, previousProduct: Product, product: Product,
  previousEdits: ProductEdits, edits: ProductEdits, actor: string) {
  const [previous] = await tx.select({ id: catalogHistory.id }).from(catalogHistory).where(historyKey(product.id)).limit(1);
  if (!previous) await tx.insert(catalogHistory).values({
    storeId, productId: product.id, edits: previousEdits, resolved: snapshot(previousProduct), actor: "source",
  });
  await tx.insert(catalogHistory).values({ storeId, productId: product.id, edits, resolved: snapshot(product), actor });
}

export async function changeProduct(id: string, expected: string, change: Change, actor: string) {
  const db = await getDb();
  await db.transaction(async tx => {
    // Imports, store-wide rules and edits take the same store lock before checking versions.
    const row = await lockedCatalog(tx);
    const source = row.source.products.find(p => p.id === id);
    if (!source) throw new CatalogInputError("პროდუქტი მიმდინარე წყაროში აღარ არის.");
    const [edit] = await tx.select().from(catalogEdits).where(editKey(id));
    checkRevision(expected, row.policyVersion + "/" + (edit?.revision ?? 0));
    let draft = edit?.draft ?? null;
    let live = edit?.live ?? {};
    let voiceItemId = edit?.voiceItemId ?? null;
    if (change.type === "restore") {
      const [version] = await tx.select().from(catalogHistory).where(and(historyKey(id), eq(catalogHistory.id, change.id)));
      if (!version) throw new CatalogInputError("ვერსია ვერ მოიძებნა.");
      draft = version.edits;
    } else if (change.type === "save") {
      draft = change.edits;
    } else {
      if (!draft) throw new CatalogInputError("ჯერ შეინახე მონახაზი.");
      const { product, applied } = prepareProduct(source, draft, row.globalRule);
      const oldPublic = row.published.products.find(p => p.id === id)!;
      const published = { ...row.published, generated_at: nextCatalogVersion(row),
        products: row.published.products.map(p => p.id === id ? product : p) };
      await recordPrices(tx, row.storeId, [oldPublic], [product], "product");
      await tx.update(storeCatalogs).set({ published, pricing: { ...row.pricing, [id]: applied } }).where(forStore());
      await recordProductVersion(tx, row.storeId, oldPublic, product, live, draft, actor);
      if (live.description !== draft.description) voiceItemId = null;
      live = draft;
      draft = null;
    }
    if (draft) prepareProduct(source, draft, row.globalRule); // validate the price before accepting the draft
    const values = { draft, live, voiceItemId, revision: (edit?.revision ?? 0) + 1 };
    await tx.insert(catalogEdits).values({ storeId: row.storeId, productId: id, ...values })
      .onConflictDoUpdate({ target: [catalogEdits.storeId, catalogEdits.productId], set: values });
  });
}
