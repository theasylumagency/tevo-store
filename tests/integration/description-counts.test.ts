import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../../src/app/api/storefront/description-views/route";
import { descriptionTotals } from "../../src/lib/voice/description-counts";

test("anonymous counters are bounded, concurrent, and isolated by store and review mode", async () => {
  const origin = "https://store.example";
  Object.assign(process.env, { DATABASE_URL: "pglite:memory", PUBLIC_BASE_URL: origin, STORE_ID: "rodo", REVIEW_MODE: "0" });
  const send = (event: string, day = "", from = origin) => POST(new Request(origin + "/api/storefront/description-views", {
    method: "POST", headers: { origin: from, "x-description-event": event, "x-description-day": day },
  }));
  assert.equal((await send("open", "", "https://elsewhere.example")).status, 403);
  assert.equal((await send("unknown")).status, 400);
  assert.equal((await send("exposed", "2024-02-31")).status, 400);
  assert.equal((await descriptionTotals()).openings, 0);
  const days = await Promise.all(Array.from({ length: 3 }, async () => (await send("open")).text()));
  assert.match(days[0], /^\d{4}-\d{2}-\d{2}$/);
  await send("exposed", "2000-01-01");
  await send("exposed", days[0]);
  assert.deepEqual(await descriptionTotals(), { openings: 3, exposures: 1, review: false });
  process.env.REVIEW_MODE = "1";
  await send("open");
  assert.deepEqual(await descriptionTotals(), { openings: 1, exposures: 0, review: true });
  process.env.REVIEW_MODE = "0";
  await Promise.all(Array.from({ length: 5 }, () => send("exposed", days[0])));
  assert.deepEqual(await descriptionTotals(), { openings: 3, exposures: 3, review: false });
  process.env.STORE_ID = "standard";
  assert.deepEqual(await descriptionTotals(), { openings: 0, exposures: 0, review: false });
});
