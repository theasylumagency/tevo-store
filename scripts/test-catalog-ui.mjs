// Disposable local store. The CI runner supplies Chrome, the database exists only for this process.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { testHomepage } from "./homepage-ui.mjs";
import { testVoice } from "./voice-ui.mjs";
import { testChoices } from "./choice-ui.mjs";
import { chromium } from "playwright-core";

const base = "http://127.0.0.1:3415";
const admin = randomUUID();
const editor = randomUUID();
const cron = randomUUID();
// Confirmed stock in the disposable test fixture only, never in the source catalog.
const fixtureDir = await mkdtemp(join(tmpdir(), "store-trust-ui-"));
const fixturePath = join(fixtureDir, "catalog.json");
const fixture = JSON.parse(await readFile("data/catalog.json", "utf8"));
const confirmed = fixture.products.find(p => p.id === "at-8425");
assert.ok(confirmed, "purchase test product exists");
confirmed.availability.status = "in_stock";
const unconfirmed = fixture.products.find(p => p.id !== confirmed.id && p.visible && p.price.base > 0 && p.availability.status === "confirm_with_store");
assert.ok(unconfirmed, "an unconfirmed purchase test product exists");
await writeFile(fixturePath, JSON.stringify(fixture));
const server = spawn(process.execPath, ["--require", "./scripts/voice-provider-fixture.cjs", "node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", "3415"], {
  stdio: "inherit",
  env: { ...process.env, STORE_ID: "rodo", DATABASE_URL: "pglite:memory", CATALOG_SOURCE: "file", CATALOG_PATH: fixturePath,
    RODO_OPENAI_API_KEY: "offline-test", RODO_AI_MODEL: "fixture", ADMIN_PASSWORD: admin, CATALOG_EDITOR_PASSWORD: editor, SESSION_SECRET: randomUUID(), CRON_TOKEN: cron,
    SMS_PROVIDER: "off", EMAIL_TRANSPORT: "off", PAYMENTS_MODE: "off", PUBLIC_BASE_URL: base },
});
const stopped = once(server, "exit");
let browser;
// Next keeps hidden copies of streamed routes in the DOM. Interact with the current view.
const visible = locator => locator.filter({ visible: true }).first();
const shopControls = '[role="search"], [data-testid="catalog-trigger"], a[href="/cart"], footer';
async function login(page, password) {
  await page.goto(base + "/admin/login?next=/admin/catalog");
  await page.locator("#admin-content:visible").first().waitFor();
  assert.equal(await page.locator(shopControls).filter({ visible: true }).count(), 0);
  await visible(page.getByLabel("პაროლი")).fill(password);
  await visible(page.getByRole("button", { name: "შესვლა", exact: true })).click();
  // The login URL also ends in /admin/catalog inside its next query parameter.
  await page.waitForURL(url => url.pathname === "/admin/catalog");
  await visible(page.getByRole("heading", { name: "პროდუქტების მართვა" })).waitFor();
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 90; attempt++) {
    if (server.exitCode !== null) break;
    ready = await fetch(base + "/api/health").then(r => r.ok).catch(() => false);
    if (ready) break;
    await delay(500);
  }
  assert.ok(ready, "isolated store started");
  const refresh = await fetch(base + "/api/revalidate", { method: "POST", headers: { Authorization: "Bearer " + cron } });
  assert.ok(refresh.ok);
  // Layout and focus assertions need actual scrollbar geometry, including reserved gutters.
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome", args: ["--no-sandbox"],
    ignoreDefaultArgs: ["--hide-scrollbars"] });
  // An explicit context supports a second authenticated admin tab for conflict/recovery checks.
  const adminContext = await browser.newContext();
  const page = await adminContext.newPage();
  const customer = await browser.newPage();
  // Use an explicit context so the editor's authenticated session can open another tab.
  const editorContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobile = await editorContext.newPage();
  const path = "/admin/catalog/at-8425";
  const productUrl = base + "/p/mini-motobloki-agri-ag-3600b";
  const title = "სატესტო სათაური · AGRI AG-3600B";
  const publicName = async () => {
    await customer.goto(productUrl);
    return customer.locator("article h1:visible").first().innerText();
  };

  const loginHtml = await (await fetch(base + "/admin/login")).text();
  assert.ok(!loginHtml.includes("searchIndex"), "admin RSC payload excludes the storefront search index");
  const initial = await publicName();
  assert.ok(await customer.locator('[role="search"]:visible').count());
  await login(mobile, editor);
  assert.equal(await mobile.locator(shopControls).filter({ visible: true }).count(), 0);
  await mobile.goto(base + "/admin/pricing");
  await mobile.waitForURL(url => url.pathname === "/admin/catalog");
  await visible(mobile.getByPlaceholder("სახელი, SKU ან მოდელი")).fill("AG-3600B");
  await visible(mobile.getByRole("button", { name: "ძებნა", exact: true })).click();
  await mobile.locator('a[href="' + path + '"]:visible').first().click();
  await mobile.locator('[name="override-name"]:visible').first().check();
  await visible(mobile.getByRole("textbox", { name: "სათაური", exact: true })).fill(title);
  await visible(mobile.getByLabel("ფასის წესი")).selectOption("fixed");
  await visible(mobile.getByLabel("დანამატი (₾)")).fill("15.25");
  await visible(mobile.getByRole("button", { name: "შენახვა და წინასწარი ნახვა" })).click();
  await mobile.waitForURL("**/preview");
  assert.equal(await mobile.locator("article h2:visible").first().innerText(), title);
  assert.equal(await mobile.getByRole("button", { name: "მონახაზის გამოქვეყნება" }).count(), 0);
  assert.equal(await publicName(), initial);
  await mobile.goto(base + "/admin/settings");
  await mobile.waitForURL(url => url.pathname === "/admin/login");

  console.log("Mobile draft saved, preview private, editor restricted.");
  await login(page, admin);
  // Follow the reviewer handoff through the catalog, including the persisted draft filter.
  await visible(page.getByRole("heading", { name: "პროდუქტების მართვა" })).waitFor();
  await visible(page.locator('select[name="status"]')).selectOption("draft");
  await visible(page.getByRole("button", { name: "ძებნა", exact: true })).click();
  await visible(page.locator('a[href="' + path + '"]')).click();
  await visible(page.getByRole("link", { name: "შენახული მონახაზის ნახვა" })).click();
  await page.waitForURL("**/preview");
  await visible(page.getByRole("button", { name: "მონახაზის გამოქვეყნება" })).click();
  await page.waitForURL("**/*?published=1");
  assert.equal(await publicName(), title);
  console.log("Administrator published the draft; public title verified.");
  const structured = await customer.locator('article:visible script[type="application/ld+json"]').first().textContent();
  assert.equal(JSON.parse(structured).offers.price, "564.25");
  await visible(customer.getByTestId("add-to-cart")).click();
  await customer.goto(base + "/cart");
  assert.match(await visible(customer.getByTestId("cart-total")).innerText(), /564[,.]25/);
  const blockedProduct = await browser.newPage();
  await blockedProduct.goto(base + "/p/" + unconfirmed.slug);
  await visible(blockedProduct.getByRole("link", { name: "ხელმისაწვდომობის დაზუსტება" })).waitFor();
  assert.equal(await visible(blockedProduct.getByTestId("add-to-cart")).isDisabled(), true);
  await customer.goto(base + "/checkout");
  await visible(customer.getByTestId("delivery-confirmation-required")).waitFor();
  assert.equal(await visible(customer.getByTestId("place-order")).isDisabled(), true);
  await visible(customer.locator('input[name="deliveryMethod"][value="pickup"]')).check();
  await customer.locator('[data-testid="place-order"]:visible:enabled').first().waitFor();
  // Request intake uses the blocked SKU without adding it to the cart or charging.
  await visible(blockedProduct.getByRole("link", { name: "ხელმისაწვდომობის დაზუსტება" })).click();
  await blockedProduct.waitForURL(url => url.pathname === "/request");
  await visible(blockedProduct.locator('input[name="name"]')).fill("მოთხოვნის ტესტი");
  await visible(blockedProduct.locator('input[name="phone"]')).fill("599000000");
  await visible(blockedProduct.locator('textarea[name="question"]')).fill("მარაგის დაზუსტება");
  await visible(blockedProduct.getByTestId("submit-purchase-request")).click();
  await blockedProduct.waitForURL(url => url.pathname.startsWith("/request/") && url.searchParams.has("t"));
  await visible(blockedProduct.getByTestId("purchase-request-receipt")).waitFor();
  const receiptUrl = blockedProduct.url();
  const requestId = new URL(receiptUrl).pathname.split("/").at(-1);
  const invalidReceipt = new URL(receiptUrl);
  invalidReceipt.searchParams.delete("t");
  await blockedProduct.goto(invalidReceipt.toString());
  await visible(blockedProduct.getByRole("heading", { name: "მოთხოვნა ვერ მოიძებნა" })).waitFor();
  const requestAdmin = await adminContext.newPage();
  await requestAdmin.goto(base + "/admin/requests");
  await visible(requestAdmin.getByTestId("purchase-requests-table")).waitFor();
  await visible(requestAdmin.locator('a[href="/admin/requests/' + requestId + '"]')).click();
  await requestAdmin.waitForURL(url => url.pathname === "/admin/requests/" + requestId);
  await visible(requestAdmin.locator('select[name="status"]')).selectOption("answered");
  await visible(requestAdmin.locator('textarea[name="response"]')).fill("სატესტო პასუხი");
  await visible(requestAdmin.getByTestId("save-request")).click();
  await requestAdmin.waitForURL(url => url.searchParams.get("result") === "saved");
  await blockedProduct.goto(receiptUrl);
  assert.equal(await visible(blockedProduct.getByTestId("purchase-request-response")).innerText(), "სატესტო პასუხი");
  const deniedEditor = await editorContext.newPage();
  await deniedEditor.goto(base + "/admin/requests/" + requestId);
  await deniedEditor.waitForURL(url => url.pathname === "/admin/login");
  await deniedEditor.close();
  await requestAdmin.close();
  await blockedProduct.close();
  // A delivery enquiry taken from the cart preserves its existing contents.
  await customer.goto(base + "/cart");
  await visible(customer.getByTestId("request-cart-offer")).click();
  await customer.waitForURL(url => url.pathname === "/request");
  await visible(customer.locator('input[name="name"]')).fill("კალათის ტესტი");
  await visible(customer.locator('input[name="phone"]')).fill("577000000");
  await visible(customer.getByTestId("submit-purchase-request")).click();
  await customer.waitForURL(url => url.pathname.startsWith("/request/"));
  await visible(customer.getByTestId("purchase-request-receipt")).waitFor();
  await customer.goto(base + "/cart");
  await visible(customer.getByTestId("cart-line")).waitFor();
  assert.match(await visible(customer.getByTestId("cart-total")).innerText(), /564[,.]25/);

  const pricing = await browser.newPage();
  await login(pricing, admin);
  await pricing.goto(base + "/admin/pricing");
  await visible(pricing.getByLabel("ფასის წესი")).selectOption("fixed");
  await visible(pricing.getByLabel("დანამატი (₾)")).fill("10");
  await visible(pricing.getByRole("button", { name: "შედეგის წინასწარი ნახვა" })).click();
  await visible(pricing.getByTestId("price-impact")).waitFor();
  assert.equal(await pricing.locator(shopControls).filter({ visible: true }).count(), 0);
  await visible(pricing.getByRole("link", { name: /ინდივიდუალური წესით/ })).click();
  assert.ok(await visible(pricing.getByRole("row").filter({ hasText: title })).innerText());
  await visible(pricing.getByRole("button", { name: /წესის გამოქვეყნება/ })).click();
  await pricing.waitForURL("**/admin/pricing?updated=1");
  await customer.goto(productUrl);
  const retained = await customer.locator('article:visible script[type="application/ld+json"]').first().textContent();
  assert.equal(JSON.parse(retained).offers.price, "564.25", "global publication preserves the product override");
  await pricing.goto(base + "/admin/pricing/history?sku=at-8425");
  assert.ok(await visible(pricing.getByRole("row").filter({ hasText: "პროდუქტის გამოქვეყნება" })).innerText());
  await pricing.goto(base + "/admin/unknown-workspace-page");
  await visible(pricing.getByRole("heading", { name: "გვერდი ვერ მოიძებნა" })).waitFor();
  assert.equal(await pricing.locator(shopControls).filter({ visible: true }).count(), 0);
  await page.reload(); // use the current store policy revision before restoring the product
  const baseline = visible(page.locator("li details").filter({ hasText: "საწყისი ვერსია" }));
  await baseline.locator("summary").click();
  await baseline.getByRole("button", { name: "მონახაზად აღდგენა" }).click();
  await page.waitForURL("**/preview");
  assert.equal(await page.locator("article h2:visible").first().innerText(), initial);
  assert.equal(await publicName(), title);
  await visible(page.getByRole("button", { name: "მონახაზის გამოქვეყნება" })).click();
  await page.waitForURL("**/*?published=1");
  assert.equal(await publicName(), initial);
  console.log("Verified mobile draft, private preview, admin publication, public price, cart and restoration.");
  await testHomepage({ page, customer, editor: mobile, base });
  await testChoices({ browser, base });
  await testVoice({ admin: page, editor: mobile, customer, base, cron });
} catch (error) {
  for (const context of browser?.contexts() ?? []) {
    for (const tab of context.pages()) {
      console.error("Visible page", new URL(tab.url()).pathname,
        await tab.locator("main:visible").first().innerText({ timeout: 2000 }).then(t => t.slice(0, 1500)).catch(() => "no visible main"));
    }
  }
  throw error;
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  await stopped;
  await rm(fixtureDir, { recursive: true, force: true });
}
