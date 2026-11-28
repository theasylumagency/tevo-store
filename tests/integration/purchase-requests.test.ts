import assert from "node:assert/strict";
import test from "node:test";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Catalog } from "../../src/lib/catalog/types";
import { getDb, schema } from "../../src/db";
import { createPurchaseRequest, getPublicRequest, getAdminRequest, listPurchaseRequests,
  newRequestToken, updatePurchaseRequest, RequestError } from "../../src/lib/requests/service";

test("enquiries preserve selection, enforce store isolation, and remain separate from sales", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "purchase-requests-"));
  try {
    const input: Catalog = JSON.parse(await readFile("data/catalog.json", "utf8"));
    const [available, hidden] = input.products;
    assert.ok(available && hidden);
    available.visible = true;
    available.availability.status = "confirm_with_store";
    available.price = { currency: "GEL", base: 100, promo: 90 };
    hidden.visible = false;
    const file = path.join(dir, "catalog.json");
    await writeFile(file, JSON.stringify(input));
    Object.assign(process.env, { DATABASE_URL: "pglite:memory", STORE_ID: "standard", CATALOG_SOURCE: "file", CATALOG_PATH: file });
    const token = newRequestToken();
    const valid = { token, name: "ტესტი", phone: "599000000", deliveryMethod: "delivery",
      locality: "მცხეთა", question: "მიწოდების ფასი?", items: [{ productId: available.id, qty: 2, unitPrice: 1, name: "spoofed" }] };
    await assert.rejects(createPurchaseRequest({ ...valid, phone: "123" }), RequestError);
    await assert.rejects(createPurchaseRequest({ ...valid, items: [{ productId: hidden.id, qty: 1 }] }), RequestError);
    await assert.rejects(createPurchaseRequest({ ...valid, items: [{ productId: available.id, qty: 21 }] }), RequestError);
    await assert.rejects(createPurchaseRequest({ ...valid, items: [...valid.items, ...valid.items] }), RequestError);
    const [first, repeat] = await Promise.all([createPurchaseRequest(valid), createPurchaseRequest(valid)]);
    assert.equal(first.id, repeat.id, "same submission token creates only one record");
    assert.equal((await listPurchaseRequests()).length, 1);
    assert.equal((await listPurchaseRequests("new")).length, 1);
    const receipt = await getPublicRequest(first.id, token);
    assert.ok(receipt);
    assert.equal(receipt.lines[0].name, available.name);
    assert.equal(receipt.lines[0].unitPrice, 9000);
    assert.equal(receipt.lines[0].qty, 2);
    assert.equal(receipt.lines[0].availability, "confirm_with_store");
    assert.ok(!("customerPhone" in receipt) && !("tokenHash" in receipt));
    assert.equal(await getPublicRequest(first.id, newRequestToken()), null);
    assert.equal(await getPublicRequest(first.id, undefined), null);
    assert.equal(await getPublicRequest("invalid", token), null);
    const admin = await getAdminRequest(first.id);
    assert.ok(admin);
    assert.equal(admin.customerPhone, "+995599000000");
    assert.notEqual(admin.tokenHash, token);
    assert.equal(admin.revision, 0);
    assert.equal(await updatePurchaseRequest(first.id, 0, "answered", " "), "invalid");
    assert.equal(await updatePurchaseRequest(first.id, 0, "in_review", ""), "saved");
    assert.equal(await updatePurchaseRequest(first.id, 0, "answered", "stale"), "conflict");
    assert.equal(await updatePurchaseRequest(first.id, 1, "answered", "დაზუსტებული პასუხი"), "saved");
    assert.equal((await getPublicRequest(first.id, token))?.response, "დაზუსტებული პასუხი");
    assert.equal((await getAdminRequest(first.id))?.history.length, 3);
    assert.equal(await updatePurchaseRequest(first.id, 2, "closed", ""), "saved");
    assert.equal(await updatePurchaseRequest(first.id, 3, "answered", "new"), "invalid");
    const db = await getDb();
    assert.equal((await db.select().from(schema.orders)).length, 0);
    assert.equal((await db.select().from(schema.payments)).length, 0);
    process.env.STORE_ID = "rodo";
    assert.equal(await getPublicRequest(first.id, token), null);
    assert.equal(await getAdminRequest(first.id), null);
    assert.equal((await listPurchaseRequests()).length, 0);
    assert.equal(await updatePurchaseRequest(first.id, 3, "answered", "wrong store"), "conflict");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
