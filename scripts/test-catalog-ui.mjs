// Disposable local store. The CI runner supplies Chrome, the database exists only for this process.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright-core";

const base = "http://127.0.0.1:3415";
const admin = randomUUID();
const editor = randomUUID();
const cron = randomUUID();
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", "3415"], {
  stdio: "inherit",
  env: { ...process.env, STORE_ID: "rodo", DATABASE_URL: "pglite:memory", CATALOG_SOURCE: "file", CATALOG_PATH: "data/catalog.json",
    ADMIN_PASSWORD: admin, CATALOG_EDITOR_PASSWORD: editor, SESSION_SECRET: randomUUID(), CRON_TOKEN: cron,
    SMS_PROVIDER: "off", EMAIL_TRANSPORT: "off", PAYMENTS_MODE: "off", PUBLIC_BASE_URL: base },
});
const stopped = once(server, "exit");
let browser;
// Next keeps hidden copies of streamed routes in the DOM. Interact with the current view.
const visible = locator => locator.filter({ visible: true }).first();
async function login(page, password) {
  await page.goto(base + "/admin/login?next=/admin/catalog");
  await visible(page.getByLabel("პაროლი")).fill(password);
  await visible(page.getByRole("button", { name: "შესვლა", exact: true })).click();
  await page.waitForURL("**/admin/catalog");
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
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const customer = await browser.newPage();
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const path = "/admin/catalog/at-8425";
  const productUrl = base + "/p/mini-motobloki-agri-ag-3600b";
  const title = "სატესტო სათაური · AGRI AG-3600B";
  const publicName = async () => {
    await customer.goto(productUrl);
    return customer.locator("article h1:visible").first().innerText();
  };

  const initial = await publicName();
  await login(mobile, editor);
  await visible(mobile.getByPlaceholder("სახელი, SKU ან მოდელი")).fill("AG-3600B");
  await visible(mobile.getByRole("button", { name: "ძებნა", exact: true })).click();
  await mobile.locator('a[href="' + path + '"]:visible').first().click();
  await mobile.locator('[name="override-name"]:visible').first().check();
  await visible(mobile.getByRole("textbox", { name: "სათაური", exact: true })).fill(title);
  await visible(mobile.getByLabel("ფასის წესი")).selectOption("fixed");
  await visible(mobile.getByLabel("დანამატი (₾)")).fill("15.25");
  await visible(mobile.getByRole("button", { name: "შენახვა და წინასწარი ნახვა" })).click();
  await mobile.waitForURL("**/preview");
  assert.equal(await mobile.locator("article h1:visible").first().innerText(), title);
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

  const baseline = visible(page.locator("li details").filter({ hasText: "საწყისი ვერსია" }));
  await baseline.locator("summary").click();
  await baseline.getByRole("button", { name: "მონახაზად აღდგენა" }).click();
  await page.waitForURL("**/preview");
  assert.equal(await page.locator("article h1:visible").first().innerText(), initial);
  assert.equal(await publicName(), title);
  await visible(page.getByRole("button", { name: "მონახაზის გამოქვეყნება" })).click();
  await page.waitForURL("**/*?published=1");
  assert.equal(await publicName(), initial);
  console.log("Verified mobile draft, private preview, admin publication, public price, cart and restoration.");
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
}
