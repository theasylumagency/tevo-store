import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const visible = locator => locator.filter({ visible: true }).first();
const selectionKey = "choices:rodo:v1";

async function selection(page) {
  return page.evaluate(key => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : { savedIds: [], comparedIds: [] };
  }, selectionKey);
}

async function openProduct(page, base, product) {
  await page.goto(`${base}/p/${product.slug}`);
  await visible(page.getByRole("heading", { level: 1, name: product.name, exact: true })).waitFor();
  return visible(page.locator(`[data-choice-actions="${product.id}"]`));
}

async function addCompared(page, base, product) {
  const controls = await openProduct(page, base, product);
  await controls.getByRole("button", { name: /^შედარებაში დამატება/ }).click();
  await controls.getByRole("button", { name: /^შედარებიდან ამოღება/ }).waitFor();
}

async function comparison(page) {
  const view = visible(page.locator("[data-choice-comparison]"));
  await view.getByRole("table").waitFor();
  return view;
}

async function assertFocused(locator, message) {
  await locator.page().waitForFunction(element => document.activeElement === element, await locator.elementHandle());
  assert.equal(await locator.evaluate(element => document.activeElement === element), true, message);
}

/** Public customer journeys only; no inherited admin cookies, catalog mutations, orders or payments. */
export async function testChoices({ browser, base }) {
  const catalog = JSON.parse(await readFile(new URL("../data/catalog.json", import.meta.url), "utf8"));
  const candidates = catalog.products.filter(product => product.visible && product.product_type === "MOTOBLOCK" && product.specs.length > 0).slice(0, 5);
  const otherType = catalog.products.find(product => product.visible && product.product_type !== "MOTOBLOCK");
  const hidden = catalog.products.find(product => !product.visible);
  assert.equal(candidates.length, 5, "comparison fixtures include five published products of the same type");
  assert.ok(otherType && hidden, "cross-type and unpublished fixtures are available");

  // Resolve the fixtures against the current publication: preceding catalog tests may have changed pricing.
  const fixtureIds = [...candidates, otherType, hidden].map(product => product.id);
  const response = await fetch(`${base}/api/storefront/choices?${new URLSearchParams({ ids: fixtureIds.join(",") })}`);
  assert.equal(response.status, 200);
  const lookup = await response.json();
  assert.ok(!lookup.products.some(product => product.id === hidden.id), "public choice lookup excludes an unpublished product");
  assert.ok(lookup.missingIds.includes(hidden.id), "unpublished selection is an explicit missing record");
  const published = new Map(lookup.products.map(product => [product.id, product]));
  const [a, b, c, d, e] = candidates.map(product => published.get(product.id));
  const different = published.get(otherType.id);
  assert.ok([a, b, c, d, e, different].every(Boolean), "published choice fixtures resolve");

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  try {
    // Save from a public PDP, navigate through the customer shortcut, then survive a full reload.
    let controls = await openProduct(page, base, a);
    await controls.getByRole("button", { name: /^შენახულში დამატება/ }).click();
    await controls.getByRole("button", { name: /^შენახულიდან ამოღება/ }).waitFor();
    await visible(page.getByRole("navigation", { name: "არჩევანის ინსტრუმენტები" })).getByRole("link", { name: /შენახული/ }).click();
    await page.waitForURL(url => url.pathname === "/saved");
    let saved = visible(page.locator(`[data-saved-product="${a.id}"]`));
    await saved.waitFor();
    await page.reload();
    saved = visible(page.locator(`[data-saved-product="${a.id}"]`));
    await saved.waitFor();
    assert.deepEqual((await selection(page)).savedIds, [a.id], "saved IDs survive reload");

    // Removing the last saved product keeps an undo action, and undo restores focus to the product.
    await saved.getByRole("button", { name: /^შენახულიდან ამოღება/ }).click();
    const undo = visible(page.getByRole("button", { name: "დაბრუნება", exact: true }));
    await undo.waitFor();
    await assertFocused(undo, "removal focuses undo even when the saved list becomes empty");
    assert.deepEqual((await selection(page)).savedIds, []);
    await undo.click();
    saved = visible(page.locator(`[data-saved-product="${a.id}"]`));
    await saved.waitFor();
    await assertFocused(saved.getByRole("link", { name: a.name, exact: true }), "undo focuses the restored product link");
    console.log("Choices: PDP save, reload persistence, last-item removal and undo focus verified.");

    // Use real customer controls for the local comparison; one remaining item must retain its full rows.
    await addCompared(page, base, a);
    await addCompared(page, base, b);
    await page.goto(base + "/compare");
    let view = await comparison(page);
    assert.equal(await view.locator("thead th").count(), 3, "two selected products have two comparison columns");
    assert.ok(await view.locator('[data-comparison-row^="spec:"]').count() > 0, "real specifications are compared");
    const allRowCount = await view.locator("[data-comparison-row]").count();
    await view.getByRole("checkbox", { name: "მხოლოდ განსხვავებები" }).check();
    assert.ok(await view.locator("[data-comparison-row]").count() <= allRowCount);
    await view.getByRole("button", { name: `შედარებიდან ამოღება: ${b.name}`, exact: true }).click();
    await view.locator("thead th").nth(1).waitFor();
    assert.equal(await view.getByRole("checkbox", { name: "მხოლოდ განსხვავებები" }).isChecked(), false);
    assert.equal(await view.getByRole("checkbox", { name: "მხოლოდ განსხვავებები" }).isDisabled(), true);
    assert.ok(await view.locator('[data-comparison-row^="spec:"]').count() > 0, "single-product specifications remain visible after filtering and removal");
    await assertFocused(view.getByRole("heading", { level: 1 }), "comparison removal focuses the stable heading");
    assert.deepEqual((await selection(page)).comparedIds, [a.id]);

    // Shared URLs are independent of the browser list, including an explicitly empty shared selection.
    await page.goto(`${base}/compare?ids=${c.id},${d.id}`);
    view = await comparison(page);
    assert.equal(await view.locator("thead th").count(), 3);
    assert.deepEqual((await selection(page)).comparedIds, [a.id], "opening a shared comparison preserves personal selection");
    await view.getByRole("button", { name: "შედარების გასუფთავება", exact: true }).click();
    await page.waitForURL(url => url.pathname === "/compare" && url.searchParams.has("ids") && url.searchParams.get("ids") === "");
    await visible(page.getByRole("heading", { name: "შეარჩიე პროდუქტები შესადარებლად", exact: true })).waitFor();
    assert.deepEqual((await selection(page)).comparedIds, [a.id], "clearing the shared URL preserves personal selection");
    console.log("Choices: comparison rows, differences-to-one recovery and independent shared URLs verified.");

    // Cross-type and capacity guards explain the failure without silently replacing any existing choice.
    controls = await openProduct(page, base, different);
    await controls.getByRole("button", { name: /^შედარებაში დამატება/ }).click();
    await controls.getByText("ერთად ერთი ტიპის პროდუქტები შეადარე.", { exact: false }).waitFor();
    assert.deepEqual((await selection(page)).comparedIds, [a.id], "cross-type rejection preserves the previous choice");
    assert.equal(await controls.getByRole("button", { name: /^შედარებაში დამატება/ }).getAttribute("aria-pressed"), "false");
    for (const product of [b, c, d]) await addCompared(page, base, product);
    controls = await openProduct(page, base, e);
    const fifth = controls.getByRole("button", { name: /^შედარებაში დამატება/ });
    await fifth.click();
    await controls.getByText("შედარებაში მაქსიმუმ 4 პროდუქტი თავსდება.", { exact: false }).waitFor();
    await fifth.click();
    assert.deepEqual((await selection(page)).comparedIds, [a.id, b.id, c.id, d.id], "repeated fifth-item attempts preserve all four choices");
    assert.equal(await fifth.getAttribute("aria-pressed"), "false");
    console.log("Choices: cross-type and four-product limits preserve existing selections.");

    // On narrow screens the table alone scrolls, and a full value column fits beside the sticky labels.
    for (const width of [390, 340]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`${base}/compare?ids=${a.id},${b.id}`);
      view = await comparison(page);
      const region = view.getByRole("region", { name: "პროდუქტების მახასიათებლების შედარება" });
      await region.evaluate(async element => { await document.fonts.ready; element.scrollLeft = 0; });
      const metrics = await region.evaluate(element => {
        const corner = element.querySelector("thead th").getBoundingClientRect();
        const value = element.querySelector("tbody td").getBoundingClientRect();
        return {
          pageClient: document.documentElement.clientWidth,
          pageScroll: document.documentElement.scrollWidth,
          regionClient: element.clientWidth,
          regionScroll: element.scrollWidth,
          available: element.clientWidth - corner.width,
          columnWidth: value.width,
        };
      });
      assert.ok(metrics.pageScroll <= metrics.pageClient + 1, `${width}px: no horizontal page overflow`);
      assert.ok(metrics.regionScroll > metrics.regionClient, `${width}px: comparison overflow stays inside its scroll region`);
      assert.ok(metrics.columnWidth <= metrics.available + 1, `${width}px: one complete product column fits beside sticky labels (${metrics.columnWidth}/${metrics.available})`);
      await region.focus();
      await region.press("ArrowRight");
      await page.waitForFunction(() => [...document.querySelectorAll('[data-choice-comparison] [role="region"]')].some(element => element.getClientRects().length && element.scrollLeft > 0));
      assert.equal(await page.evaluate(() => document.documentElement.scrollLeft), 0, `${width}px: keyboard scrolling does not move the whole page`);
      const lastProductLink = view.locator("thead").getByRole("link", { name: b.name, exact: true });
      await lastProductLink.focus();
      const focusBounds = await lastProductLink.evaluate(element => {
        const region = element.closest('[role="region"]');
        const corner = region.querySelector("thead th").getBoundingClientRect();
        const box = element.getBoundingClientRect();
        const frame = region.getBoundingClientRect();
        return { left: box.left, right: box.right, visibleLeft: corner.right, visibleRight: frame.left + region.clientLeft + region.clientWidth };
      });
      assert.ok(focusBounds.left >= focusBounds.visibleLeft - 1 && focusBounds.right <= focusBounds.visibleRight + 1, `${width}px: focused product link is not covered by sticky labels or the viewport edge`);
    }
    console.log("Choices: 390px/340px containment, readable table columns and keyboard focus scrolling verified.");
  } catch (error) {
    console.error("Choice UI failure", new URL(page.url()).pathname,
      await visible(page.locator("main")).innerText({ timeout: 2000 }).then(text => text.slice(0, 1800)).catch(() => "no visible main"));
    throw error;
  } finally {
    await context.close();
  }
}
