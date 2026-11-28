import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Catalog } from "../../src/lib/catalog/types";
import { getDb, schema } from "../../src/db";
import { readPublication } from "../../src/lib/catalog/published";
import { quotePublication } from "../../src/lib/orders/quote";
import { CheckoutError, createOrder } from "../../src/lib/orders/service";
import { availablePaymentMethods } from "../../src/lib/payments/providers";

test("confirmed terms are mandatory before an order or payment can be created", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "purchase-trust-"));
  try {
    const input: Catalog = JSON.parse(await readFile("data/catalog.json", "utf8"));
    const [confirmed, uncertain] = input.products;
    assert.ok(confirmed && uncertain);
    for (const p of [confirmed, uncertain]) {
      p.visible = true;
      p.price = { currency: "GEL", base: 100, promo: null };
    }
    confirmed.availability.status = "in_stock";
    uncertain.availability.status = "confirm_with_store";
    const file = path.join(dir, "catalog.json");
    await writeFile(file, JSON.stringify(input));
    Object.assign(process.env, { DATABASE_URL: "pglite:memory", STORE_ID: "standard",
      CATALOG_SOURCE: "file", CATALOG_PATH: file, PAYMENTS_MODE: "test", ALLOW_TEST_PAYMENTS: "1" });
    const catalog = await readPublication();
    const items = [{ productId: confirmed.id, qty: 1 }, { productId: uncertain.id, qty: 1 }];
    const quote = quotePublication(items, catalog);
    assert.equal(quote.lines.length, 2, "known prices and selections remain visible");
    assert.equal(quote.subtotal, 20_000);
    assert.deepEqual(quote.problems, [{ productId: uncertain.id, kind: "stock_unconfirmed" }]);
    const base = { name: "ტესტი", phone: "+995599000000", termsVersion: "test", items };
    for (const paymentMethod of ["cash", "card", "installment"] as const) {
      await assert.rejects(createOrder({ ...base, paymentMethod, deliveryMethod: "pickup" }, { acceptChanges: true }),
        (e: unknown) => e instanceof CheckoutError && e.code === "stock_unconfirmed");
      await assert.rejects(createOrder({ ...base, items: [items[0]], paymentMethod, deliveryMethod: "delivery" }),
        (e: unknown) => e instanceof CheckoutError && e.code === "delivery_unconfirmed");
    }
    const db = await getDb();
    assert.equal((await db.select().from(schema.orders)).length, 0);
    assert.equal((await db.select().from(schema.payments)).length, 0);
    assert.deepEqual(quotePublication([items[0]], catalog).problems, []);
    assert.equal(quotePublication([items[0]], catalog).deliveryFee, null);
    process.env.PAYMENTS_MODE = "live";
    Object.assign(process.env, { BOG_CLIENT_ID_STANDARD: "fixture", BOG_CLIENT_SECRET_STANDARD: "fixture",
      TBC_API_KEY_STANDARD: "fixture", TBC_CLIENT_ID_STANDARD: "fixture", TBC_CLIENT_SECRET_STANDARD: "fixture" });
    assert.deepEqual(availablePaymentMethods("standard", ["card", "installment", "cash"]), ["cash"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
