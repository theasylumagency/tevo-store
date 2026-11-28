import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const visible = locator => locator.filter({ visible: true }).first();

export async function testDecisionPaths({ browser, base, productUrl }) {
  const catalog = JSON.parse(await readFile(new URL("../data/catalog.json", import.meta.url), "utf8"));
  const expected = catalog.products.filter(p => p.visible && p.product_type === "MOTOBLOCK").map(p => p.id).sort();
  assert.ok(expected.length > 0);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await page.goto(base);
    const entry = visible(page.getByTestId("decision-entry"));
    await entry.waitFor();
    for (const href of ["/search", "/choose", "/help"]) assert.equal(await entry.locator('a[href="' + href + '"]').count(), 1);
    await visible(entry.locator('a[href="/choose"]')).click();
    await page.waitForURL(url => url.pathname === "/choose");
    await visible(page.getByTestId("task-directory").locator('[data-task-id="soil"]')).click();
    await page.waitForURL(url => url.pathname === "/choose/soil");
    await visible(page.getByRole("heading", { name: "მიწის დამუშავება", exact: true })).waitFor();
    const section = visible(page.getByTestId("task-products"));
    await section.locator("[data-product-card]").first().waitFor();
    const actual = await section.locator("[data-product-card]").evaluateAll(els => els.map(el => el.getAttribute("data-product-card")).sort());
    assert.deepEqual(actual, expected, "work scope is a catalog-backed set, not a generated recommendation");
    const measure = await page.locator("main").evaluate(el => ({ width: el.clientWidth, scroll: el.scrollWidth }));
    assert.ok(measure.scroll <= measure.width + 1, "task screen fits a mobile viewport");
    await page.goto(base + "/choose/soil?type=GENERATOR");
    await visible(page.getByTestId("task-products").locator('a[href="/choose/soil"]')).waitFor();
    assert.equal(await page.getByTestId("task-products").locator("[data-product-card]:visible").count(), 0);
    await page.goto(base + "/choose/soil");
    await visible(page.getByTestId("task-products").locator("[data-product-card]").first()).waitFor();
    await visible(page.getByTestId("nav-help")).click();
    await page.waitForURL(url => url.pathname === "/help");
    await visible(page.getByTestId("decision-help")).waitFor();
    await page.goto(base + productUrl);
    await visible(page.getByTestId("product-decision-help").locator('a[href="/choose/soil"]')).waitFor();
    assert.equal((await page.goto(base + "/choose/not-a-task")).status(), 404);
    console.log("Decision paths: permanent home entries, mobile task scope, real filtering, help, product context and unknown-task 404 verified.");
  } finally {
    await context.close();
  }
}
