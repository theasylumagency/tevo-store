import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const visible = locator => locator.filter({ visible: true }).first();
async function capture(page, filename) {
  if (!process.env.HOMEPAGE_QA_DIR) return;
  await mkdir(process.env.HOMEPAGE_QA_DIR, { recursive: true });
  await page.screenshot({ path: path.join(process.env.HOMEPAGE_QA_DIR, filename), fullPage: true });
}
async function assertHomeGuardrails(home, context) {
  await home.waitFor({ state: "visible" });
  assert.equal(await home.locator("h1").count(), 1, `${context}: exactly one page heading`);
  assert.ok(await home.locator('a[href="/search"]').filter({ visible: true }).count(), `${context}: visible full-catalog escape`);
  const width = await home.evaluate(element => ({ client: element.clientWidth, scroll: element.scrollWidth }));
  assert.ok(width.scroll <= width.client + 1, `${context}: no horizontal content overflow (${width.scroll}/${width.client})`);
}
async function homePresentationMetrics(home) {
  const metrics = await home.evaluate(async element => {
    await document.fonts.ready;
    const heading = element.querySelector("h1");
    const grid = element.querySelector('[data-home-block="picks"] ul');
    if (!heading || !grid) return null;
    const headingStyle = getComputedStyle(heading);
    return {
      h1FontSize: headingStyle.fontSize,
      h1LineHeight: headingStyle.lineHeight,
      productGridColumns: getComputedStyle(grid).gridTemplateColumns.split(/\s+/).length,
    };
  });
  assert.ok(metrics, "heading and shared product grid are available for preview comparison");
  return metrics;
}
export async function testHomepage({ page, customer, editor, base }) {
  const adminPath = "/admin/homepage";
  const home = customer.locator("[data-home-preset]:visible").first();
  await customer.goto(base);
  assert.equal(await home.getAttribute("data-home-preset"), "catalog");
  await assertHomeGuardrails(home, "published catalog");

  await editor.goto(base + adminPath);
  await editor.waitForURL(url => url.pathname === "/admin/catalog");
  // Back before the debounce runs must preserve text even after the old route is reloaded.
  await page.goto(base + "/admin/catalog");
  await visible(page.getByRole("link", { name: "მთავარი გვერდი", exact: true })).click();
  await page.waitForURL(url => url.pathname === adminPath);
  const recoveryTitle = "უკან დაბრუნებისას შენარჩუნებული მონახაზი";
  await visible(page.getByLabel("მთავარი სათაური")).fill(recoveryTitle);
  await page.goBack();
  await page.waitForURL(url => url.pathname === "/admin/catalog");
  await page.reload();
  await visible(page.getByRole("link", { name: "მთავარი გვერდი", exact: true })).click();
  await visible(page.getByTestId("home-recovery")).waitFor();
  assert.ok((await visible(page.getByTestId("home-recovery")).innerText()).includes(recoveryTitle));
  await visible(page.getByRole("button", { name: "ადგილობრივი მონახაზის აღდგენა", exact: true })).click();
  await visible(page.getByTestId("home-save-state").filter({ hasText: "მონახაზი შენახულია" })).waitFor();
  assert.equal(await visible(page.getByLabel("მთავარი სათაური")).inputValue(), recoveryTitle);

  await visible(page.getByRole("radio", { name: /არჩევანში დახმარება/ })).check();
  // The allowed maximum, without spaces, exercises wrapping as well as draft persistence.
  const title = "სატესტომთავარიგვერდი".repeat(6).slice(0, 100);
  assert.equal(title.length, 100);
  await visible(page.getByLabel("მთავარი სათაური")).fill(title);
  await visible(page.getByTestId("home-save-state").filter({ hasText: "მონახაზი შენახულია" })).waitFor();
  await page.reload();
  assert.equal(await visible(page.getByLabel("მთავარი სათაური")).inputValue(), title, "autosave survives reload");
  await capture(page, "homepage-editor-desktop.png");
  if (process.env.HOMEPAGE_QA_DIR) {
    const editorViewport = page.viewportSize();
    await page.setViewportSize({ width: 390, height: 844 });
    await capture(page, "homepage-editor-mobile.png");
    await page.setViewportSize(editorViewport ?? { width: 1280, height: 720 });
  }
  await customer.reload();
  assert.equal(await home.getAttribute("data-home-preset"), "catalog", "autosave does not publish");
  assert.ok(!(await home.innerText()).includes(title));
  // The preview action must wait for an upload response and then save its photo path.
  const uploadName = "homepage-upload-race.png";
  let releaseUpload;
  const uploadGate = new Promise(resolve => { releaseUpload = resolve; });
  const isUpload = request => request.method() === "POST" && request.postDataBuffer()?.includes(Buffer.from(uploadName));
  const holdUpload = async route => { if (isUpload(route.request())) await uploadGate; await route.continue(); };
  await page.route("**/admin/homepage**", holdUpload);
  const uploadRequest = page.waitForRequest(isUpload);
  try {
    const photo = await sharp({ create: { width: 48, height: 32, channels: 3, background: "#d5e6d2" } }).png().toBuffer();
    await visible(page.getByLabel("ფოტო მედიათეკიდან · ატვირთვა", { exact: true })).setInputFiles({ name: uploadName, mimeType: "image/png", buffer: photo });
    await uploadRequest;
    await visible(page.getByTestId("home-upload-state")).waitFor();
    await visible(page.getByRole("button", { name: "შენახვა და წინასწარი ნახვა" })).click();
    assert.equal(new URL(page.url()).pathname, adminPath, "preview waits for the pending photo");
  } finally { releaseUpload(); }
  await page.waitForURL(url => url.pathname === adminPath + "/preview");
  await page.unroute("**/admin/homepage**", holdUpload);
  const preview = visible(page.getByTestId("homepage-preview"));
  const previewHome = visible(preview.locator("[data-home-preset]"));
  assert.equal(await visible(preview.getByRole("heading", { level: 1 })).innerText(), title);
  assert.ok(await visible(preview.locator('img[src*="homepage"]')).count(), "uploaded photo is in the saved preview");
  await assertHomeGuardrails(previewHome, "guide desktop preview");
  await capture(page, "homepage-preview-desktop.png");
  await visible(page.getByRole("link", { name: "მობილური", exact: true })).click();
  await page.waitForURL(url => url.searchParams.get("screen") === "mobile");
  assert.equal(Math.round((await preview.boundingBox()).width), 390);
  await assertHomeGuardrails(previewHome, "guide mobile preview");
  const mobilePreviewMetrics = await homePresentationMetrics(previewHome);
  await capture(page, "homepage-preview-mobile.png");
  await customer.reload();
  assert.equal(await home.getAttribute("data-home-preset"), "catalog");
  assert.ok(!(await home.innerText()).includes(title));
  await visible(page.getByRole("button", { name: "ახლავე გამოქვეყნება" })).click();
  await page.waitForURL(url => url.searchParams.get("done") === "publish");
  await customer.reload();
  assert.equal(await home.getAttribute("data-home-preset"), "guide");
  assert.equal(await visible(home.getByRole("heading", { level: 1 })).innerText(), title);
  await assertHomeGuardrails(home, "published guide");
  const customerViewport = customer.viewportSize();
  try {
    await customer.setViewportSize({ width: 390, height: 844 });
    await assertHomeGuardrails(home, "published guide at 390px");
    assert.deepEqual(await homePresentationMetrics(home), mobilePreviewMetrics,
      "390px public homepage matches mobile preview typography and product-grid columns");
  } finally {
    await customer.setViewportSize(customerViewport ?? { width: 1280, height: 720 });
  }

  await visible(page.getByRole("radio", { name: /შეთავაზება პირველ რიგში/ })).check();
  await visible(page.getByRole("button", { name: "შენახვა და წინასწარი ნახვა" })).click();
  await page.waitForURL(url => url.pathname === adminPath + "/preview");
  const offerTitle = await visible(preview.getByRole("heading", { level: 1 })).innerText();
  assert.notEqual(offerTitle, title);
  await assertHomeGuardrails(previewHome, "offer preview");
  await visible(page.locator("summary").filter({ hasText: "გამოქვეყნების დაგეგმვა" })).click();
  const future = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16);
  await visible(page.locator('input[name="start"]')).fill(future);
  await visible(page.getByRole("button", { name: "დაგეგმვა", exact: true })).click();
  await page.waitForURL(url => url.searchParams.get("done") === "schedule");
  await customer.reload();
  assert.equal(await home.getAttribute("data-home-preset"), "guide");
  await visible(page.getByRole("button", { name: "განრიგის გაუქმება" })).click();
  await page.waitForURL(url => url.searchParams.get("done") === "cancel");
  await visible(page.getByRole("link", { name: "შენახული ვერსიის ნახვა" })).click();
  await visible(page.getByRole("button", { name: "ახლავე გამოქვეყნება" })).click();
  await page.waitForURL(url => url.searchParams.get("done") === "publish");
  await customer.reload();
  assert.equal(await home.getAttribute("data-home-preset"), "offer");
  assert.equal(await visible(home.getByRole("heading", { level: 1 })).innerText(), offerTitle);
  await assertHomeGuardrails(home, "published offer");

  // Two administrators retain their own visible text; a stale save never overwrites the current draft.
  const stale = await page.context().newPage();
  await stale.goto(base + adminPath);
  await visible(stale.getByLabel("მთავარი სათაური")).waitFor();
  const latestTitle = "მონახაზის უახლესი ცვლილება";
  const staleTitle = "სხვა ფანჯრის შეუნახავი ტექსტი";
  await visible(page.getByLabel("მთავარი სათაური")).fill(latestTitle);
  await visible(page.getByTestId("home-save-state").filter({ hasText: "მონახაზი შენახულია" })).waitFor();
  await visible(stale.getByLabel("მთავარი სათაური")).fill(staleTitle);
  await visible(stale.getByTestId("home-save-state").filter({ hasText: "ვერსიები ერთმანეთს არ ემთხვევა" })).waitFor();
  assert.equal(await visible(stale.getByLabel("მთავარი სათაური")).inputValue(), staleTitle, "conflict retains local text");
  stale.once("dialog", dialog => dialog.accept());
  await stale.reload();
  await visible(stale.getByTestId("home-recovery-newer")).waitFor();
  assert.equal(await visible(stale.getByLabel("მთავარი სათაური")).inputValue(), latestTitle, "newer server draft is not replaced by recovery");
  assert.ok((await visible(stale.getByTestId("home-recovery")).innerText()).includes(staleTitle), "stale text survives reload for explicit review");
  assert.ok(await visible(stale.getByLabel("მთავარი სათაური")).isDisabled(), "recovery choice precedes editing");
  await visible(stale.getByRole("button", { name: "სერვერზე შენახულით გაგრძელება", exact: true })).click();
  await stale.close();
  await page.reload();
  assert.equal(await visible(page.getByLabel("მთავარი სათაური")).inputValue(), latestTitle);

  // Searchable manual collection shows its actual eligible selection and stays private until publish.
  await visible(page.getByRole("button", { name: "სეზონური შერჩევა", exact: true })).click();
  await visible(page.getByLabel("სეზონური შერჩევა · ჩართვა")).check();
  await visible(page.getByLabel("ძებნა · პროდუქტის დამატება")).fill("at-8425");
  await visible(page.getByRole("button").filter({ hasText: "at-8425" })).click();
  assert.match(await visible(page.getByTestId("seasonal-result")).innerText(), /ახლა გამოჩნდება 1 პროდუქტი/);
  await visible(page.getByTestId("home-save-state").filter({ hasText: "მონახაზი შენახულია" })).waitFor();

  // Restoring a release is another private draft change, not an immediate public rollback.
  await visible(page.getByRole("link", { name: "ცვლილებების ისტორია" })).click();
  await page.waitForURL(url => url.pathname === adminPath + "/history");
  const initialVersion = visible(page.getByTestId("home-history-entry").filter({ hasText: "საწყისი ვერსია" }));
  await initialVersion.getByRole("button", { name: "მონახაზში აღდგენა" }).click();
  await page.waitForURL(url => url.searchParams.get("done") === "restore");
  assert.ok(await visible(page.getByRole("radio", { name: /კატალოგი პირველ რიგში/ })).isChecked());
  await customer.reload();
  assert.equal(await home.getAttribute("data-home-preset"), "offer", "history restore stays private");
  await visible(page.getByRole("link", { name: "ცვლილებების ისტორია" })).click();
  await visible(page.getByTestId("home-history-entry").filter({ hasText: "აღდგენამდე არსებული მონახაზი" })).waitFor();
  console.log("Homepage verified: private autosave, Back/reload recovery, stale recovery safety, upload/preview ordering, manual collection, restore checkpoint, composition guardrails, maximum-length copy, mobile preview parity and releases.");
}
