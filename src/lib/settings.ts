import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { getStore, type LegalEntity, type StoreConfig, type StoreContact } from "@/config/store";

const { storeSettings, storeSettingsHistory } = schema;

const opt = (max: number) => z.string().trim().max(max).transform((v) => v || null).nullable();

export const settingsSchema = z.object({
  legal: z.object({
    name: opt(160), idCode: z.string().trim().regex(/^(\d{9}|\d{11})?$/, "idCode").transform((v) => v || null).nullable(),
    legalAddress: opt(240), director: opt(120),
  }),
  contact: z.object({
    phone: opt(40), email: z.string().trim().max(120).refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "email")
      .transform((v) => v || null).nullable(),
    hours: opt(160), pickupAddress: opt(240), serviceAddress: opt(240),
  }),
  staff: z.object({
    emails: z.array(z.string().trim().toLowerCase().pipe(z.email())).max(10),
    telegram: z.boolean(),       // send new orders to the connected Telegram chats
  }),
});

export type StoreSettings = z.infer<typeof settingsSchema>;

const envList = (v?: string) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

/** Defaults come from src/config/store.ts (+ STAFF_EMAILS), so a fresh install works before anything is saved. */
function defaults(store: StoreConfig): StoreSettings {
  return { legal: store.legal, contact: store.contact, staff: { emails: envList(process.env.STAFF_EMAILS), telegram: true } };
}

function merge(base: StoreSettings, saved: unknown): StoreSettings {
  const s = (saved ?? {}) as Partial<StoreSettings>;
  return {
    legal: { ...base.legal, ...s.legal } as LegalEntity,
    contact: { ...base.contact, ...s.contact } as StoreContact,
    staff: { ...base.staff, ...s.staff },
  };
}

async function load(storeId: string, base: StoreSettings) {
  const db = await getDb();
  const [row] = await db.select().from(storeSettings).where(eq(storeSettings.storeId, storeId));
  return { settings: merge(base, row?.data), updatedAt: row?.updatedAt?.toISOString() ?? null };
}

/** Cached for every visitor; saving in the admin refreshes it immediately (tag "settings"). */
async function cachedSettings(): Promise<StoreSettings> {
  "use cache";
  cacheLife("max");
  cacheTag("settings");
  const store = getStore();
  return (await load(store.id, defaults(store))).settings;
}

/**
 * Deliberately no fallback to defaults on a database error: a page re-rendered in the background would cache
 * the empty seller details ("შესავსებია") on the legal pages. A failed background render keeps the previous page.
 */
export const getSettings = cachedSettings;

/** Store config with the admin-edited seller and contact details applied — use this wherever they are shown. */
export async function getStoreProfile(): Promise<StoreConfig> {
  const store = getStore();
  const s = await getSettings();
  return { ...store, legal: s.legal, contact: s.contact };
}

/** Admin: uncached read with the last change time. */
export async function readSettingsForAdmin() {
  const store = getStore();
  return load(store.id, defaults(store));
}

export async function saveSettings(data: StoreSettings) {
  const db = await getDb();
  const storeId = getStore().id;
  await db.transaction(async (tx) => {
    await tx.insert(storeSettings).values({ storeId, data, updatedAt: new Date() })
      .onConflictDoUpdate({ target: storeSettings.storeId, set: { data, updatedAt: new Date() } });
    await tx.insert(storeSettingsHistory).values({ storeId, data });
  });
}

export async function settingsHistory(limit = 10) {
  const db = await getDb();
  return db.select().from(storeSettingsHistory).where(eq(storeSettingsHistory.storeId, getStore().id))
    .orderBy(desc(storeSettingsHistory.changedAt)).limit(limit);
}
