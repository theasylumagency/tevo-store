import "server-only";
import { and, eq, gte, lt, sql, sum } from "drizzle-orm";
import { getStore } from "@/config/store";
import { getDb } from "@/db";
import { descriptionCounts as counts } from "@/db/schema";

const today = sql<string>`(current_timestamp at time zone 'Asia/Tbilisi')::date`;
const reportingPeriod = gte(counts.day, sql`${today} - 29`);
function currentStore() {
  const store = getStore();
  return and(eq(counts.storeId, store.id), eq(counts.review, store.showReview));
}

export async function countDescriptionOpening() {
  const { id, showReview } = getStore();
  const [row] = await (await getDb()).insert(counts).values({ storeId: id, review: showReview, day: today, openings: 1 })
    .onConflictDoUpdate({ target: [counts.storeId, counts.review, counts.day], set: { openings: sql`${counts.openings} + 1` } })
    .returning({ day: counts.day });
  return row.day;
}

export async function countDescriptionExposure(day: string) {
  // Charge the exposure to the opening's day even if the buyer crosses midnight.
  await (await getDb()).update(counts).set({ exposures: sql`${counts.exposures} + 1` })
    .where(and(currentStore(), reportingPeriod, eq(counts.day, day), lt(counts.exposures, counts.openings)));
}

export async function descriptionTotals() {
  const [row] = await (await getDb()).select({ openings: sum(counts.openings), exposures: sum(counts.exposures) })
    .from(counts).where(and(currentStore(), reportingPeriod));
  return { openings: Number(row.openings), exposures: Number(row.exposures), review: getStore().showReview };
}
