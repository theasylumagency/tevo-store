import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import type { Catalog } from "../../src/lib/catalog/types";
import { getDb, schema } from "../../src/db";
import { readPublication } from "../../src/lib/catalog/published";
import { createPurchaseRequest, getPublicRequest, getAdminRequest, newRequestToken, updatePurchaseRequest } from "../../src/lib/requests/service";
import { decideOffer, issueOffer, withdrawOffer } from "../../src/lib/requests/offers";
import { parseOfferMoney } from "../../src/lib/requests/offer-model";
import { createOrder } from "../../src/lib/orders/service";
import { getStore } from "../../src/config/store";

test("versioned complete offers become exactly one order only on explicit acceptance", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "purchase-offers-"));
  try {
    const input: Catalog = JSON.parse(await readFile("data/catalog.json", "utf8"));
    const [uncertain, confirmed] = input.products;
    assert.ok(uncertain && confirmed);
    uncertain.visible = true;
    uncertain.availability.status = "confirm_with_store";
    uncertain.price = { currency: "GEL", base: null, promo: null };
    confirmed.visible = true;
    confirmed.availability.status = "in_stock";
    confirmed.price = { currency: "GEL", base: 100, promo: null };
    const file = path.join(dir, "catalog.json");
    await writeFile(file, JSON.stringify(input));
    Object.assign(process.env, { DATABASE_URL: "pglite:memory", STORE_ID: "standard", CATALOG_SOURCE: "file",
      CATALOG_PATH: file, PAYMENTS_MODE: "off", SMS_PROVIDER: "off", EMAIL_TRANSPORT: "off" });
    const db = await getDb();
    const makeRequest = async () => createPurchaseRequest({ token: newRequestToken(), name: "ტესტი", phone: "599000000",
      deliveryMethod: "delivery", locality: "მცხეთა", question: "სრული ფასი?", items: [{ productId: uncertain.id, qty: 2 }] });
    const offer = { prices: { [uncertain.id]: 12500 }, deliveryMethod: "delivery", region: "მცხეთა-მთიანეთი",
      city: "მცხეთა", address: "ტესტის ქუჩა 1", fulfilment: "მომდევნო სამუშაო დღეს", deliveryFee: 2500,
      expiresHours: 24, stockEvidence: "სატესტო საწყობის დადასტურება", confirmed: true };
    const r = await makeRequest();
    const accept = { id: r.id, token: r.token, version: 1, decision: "accept" as const, consent: true,
      termsVersion: getStore().termsVersion, clarification: "" };
    assert.equal(parseOfferMoney(""), null);
    assert.equal(parseOfferMoney("0", true), 0);
    assert.equal(parseOfferMoney("12,34"), 1234);
    assert.equal(parseOfferMoney("12.345"), null);
    assert.equal(await issueOffer(r.id, 0, { ...offer, confirmed: false }), "invalid");
    assert.equal(await issueOffer(r.id, 0, { ...offer, deliveryFee: null }), "invalid");
    assert.equal(await issueOffer(r.id, 0, { ...offer, prices: { [uncertain.id]: 0 } }), "invalid");
    assert.equal(await issueOffer(r.id, 0, offer), "saved");
    assert.equal(await issueOffer(r.id, 0, offer), "conflict");
    assert.equal(await updatePurchaseRequest(r.id, 1, "closed", ""), "invalid");
    const first = (await getPublicRequest(r.id, r.token))!.offers[0];
    assert.equal(first.total, 27500);
    assert.ok(!("stockEvidence" in first));
    assert.equal((await db.select().from(schema.orders)).length, 0);
    assert.equal((await decideOffer({ ...accept, consent: false })).result, "invalid");
    assert.equal((await decideOffer({ ...accept, token: newRequestToken() })).result, "conflict");
    assert.equal((await decideOffer({ ...accept, termsVersion: "old" })).result, "terms_changed");
    assert.equal((await decideOffer({ ...accept, decision: "clarify", clarification: "მიტანის დრო?" })).result, "clarification");
    assert.equal((await getAdminRequest(r.id))?.status, "in_review");
    assert.equal(await issueOffer(r.id, 2, offer), "saved");
    assert.equal(await issueOffer(r.id, 3, { ...offer, deliveryFee: 3500 }), "saved");
    assert.equal((await getPublicRequest(r.id, r.token))?.offers[1].state, "superseded");
    assert.equal((await decideOffer({ ...accept, version: 2 })).result, "conflict");

    // No reservation is implied; reject changed/unavailable catalog facts before acceptance.
    const publication = await readPublication();
    const unavailable = { ...publication, products: publication.products.map(p => p.id === uncertain.id
      ? { ...p, availability: { ...p.availability, status: "out_of_stock" as const } } : p) };
    await db.update(schema.storeCatalogs).set({ published: unavailable }).where(eq(schema.storeCatalogs.storeId, "standard"));
    assert.equal((await decideOffer({ ...accept, version: 3 })).result, "unavailable");
    await db.update(schema.storeCatalogs).set({ published: publication }).where(eq(schema.storeCatalogs.storeId, "standard"));

    const accepted = { ...accept, version: 3 };
    const [one, two] = await Promise.all([decideOffer(accepted), decideOffer(accepted)]);
    assert.equal(one.result, "accepted");
    assert.equal(two.result, "accepted");
    assert.equal(one.redirectUrl, two.redirectUrl);
    const orders = await db.select().from(schema.orders);
    assert.equal(orders.length, 1);
    assert.equal(orders[0].subtotal, 25000);
    assert.equal(orders[0].deliveryFee, 3500);
    assert.equal(orders[0].total, 28500);
    assert.equal(orders[0].paymentStatus, "unpaid");
    assert.equal(orders[0].address, offer.address);
    const items = await db.select().from(schema.orderItems);
    assert.equal(items.length, 1);
    assert.equal(items[0].quantity, 2);
    assert.equal(items[0].unitPrice, 12500);
    assert.equal((await db.select().from(schema.payments)).length, 0);
    assert.equal((await getPublicRequest(r.id, r.token))?.convertedOrderUrl, one.redirectUrl);
    assert.equal(await issueOffer(r.id, 5, offer), "invalid");
    process.env.STORE_ID = "rodo";
    assert.equal((await decideOffer(accepted)).result, "conflict");
    assert.equal(await getPublicRequest(r.id, r.token), null);
    process.env.STORE_ID = "standard";

    const other = await makeRequest();
    assert.equal(await issueOffer(other.id, 0, offer), "saved");
    assert.equal(await withdrawOffer(other.id, 1), "withdrawn");
    assert.equal((await decideOffer({ ...accept, id: other.id, token: other.token })).result, "conflict");
    assert.equal(await issueOffer(other.id, 2, offer), "saved");
    const admin = (await getAdminRequest(other.id))!;
    const expired = admin.offers.map((o, i) => i === admin.offers.length - 1 ? { ...o, expiresAt: "2000-01-01T00:00:00.000Z" } : o);
    await db.update(schema.purchaseRequests).set({ offers: expired }).where(eq(schema.purchaseRequests.id, other.id));
    assert.equal((await decideOffer({ ...accept, id: other.id, token: other.token, version: 2 })).result, "expired");
    assert.equal(await issueOffer(other.id, 3, offer), "saved");
    assert.equal((await decideOffer({ ...accept, id: other.id, token: other.token, version: 3, decision: "reject" })).result, "rejected");
    assert.equal((await db.select().from(schema.orders)).length, 1);
    // A confirmed product still uses the original, independent direct checkout.
    const direct = await createOrder({ items: [{ productId: confirmed.id, qty: 1 }], name: "ტესტი", phone: "+995599000000",
      paymentMethod: "cash", deliveryMethod: "pickup", termsVersion: getStore().termsVersion });
    assert.equal(direct.order.total, 10000);
    assert.equal((await db.select().from(schema.orders)).length, 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
