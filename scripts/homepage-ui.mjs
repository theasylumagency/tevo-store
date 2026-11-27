import assert from "node:assert/strict";

const visible = locator => locator.filter({ visible: true }).first();
export async function testHomepage({ page, customer, editor, base }) {
  const adminPath = "/admin/homepage";
  const home = customer.locator("[data-home-preset]:visible").first();
  await customer.goto(base);
  assert.equal(await home.getAttribute("data-home-preset"), "catalog");

  await editor.goto(base + adminPath);
  await editor.waitForURL(url => url.pathname === "/admin/catalog");
  await page.goto(base + adminPath);
  await visible(page.getByRole("radio", { name: /არჩევანში დახმარება/ })).check();
  const title = "სატესტო მთავარი გვერდი";
  await visible(page.getByLabel("მთავარი სათაური")).fill(title);
  await visible(page.getByRole("button", { name: "შენახვა და წინასწარი ნახვა" })).click();
  await page.waitForURL(url => url.pathname === adminPath + "/preview");
  const preview = visible(page.getByTestId("homepage-preview"));
  assert.equal(await visible(preview.getByRole("heading", { level: 1 })).innerText(), title);
  await visible(page.getByRole("link", { name: "მობილური", exact: true })).click();
  await page.waitForURL(url => url.searchParams.get("screen") === "mobile");
  assert.equal(Math.round((await preview.boundingBox()).width), 390);
  await customer.reload();
  assert.equal(await home.getAttribute("data-home-preset"), "catalog");
  assert.ok(!(await home.innerText()).includes(title));
  await visible(page.getByRole("button", { name: "ახლავე გამოქვეყნება" })).click();
  await page.waitForURL(url => url.searchParams.get("done") === "publish");
  await customer.reload();
  assert.equal(await home.getAttribute("data-home-preset"), "guide");
  assert.equal(await visible(home.getByRole("heading", { level: 1 })).innerText(), title);

  await visible(page.getByRole("radio", { name: /შეთავაზება პირველ რიგში/ })).check();
  await visible(page.getByRole("button", { name: "შენახვა და წინასწარი ნახვა" })).click();
  await page.waitForURL(url => url.pathname === adminPath + "/preview");
  const offerTitle = await visible(preview.getByRole("heading", { level: 1 })).innerText();
  assert.notEqual(offerTitle, title);
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
  console.log("Homepage verified: restricted editor, private preview, mobile composition, immediate and scheduled publication.");
}
