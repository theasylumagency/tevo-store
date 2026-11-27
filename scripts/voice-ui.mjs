import assert from "node:assert/strict";

const visible = locator => locator.filter({ visible: true }).first();
export async function testVoice({ admin, editor, customer, base, cron }) {
  await admin.goto(base + "/admin/voice");
  await visible(admin.getByLabel("როგორ ვწერთ")).fill("მოკლედ და გასაგებად.");
  await visible(admin.getByRole("button", { name: "პროფილის შენახვა" })).click();
  await admin.waitForURL(url => url.searchParams.has("saved"));
  await visible(admin.locator('select[name="scope"]')).selectOption("selected");
  await visible(admin.getByLabel("პროდუქტის ძიება")).fill("at-8425");
  await visible(admin.locator('li input[type="checkbox"]')).check();
  await visible(admin.getByRole("button", { name: /აღწერების მომზადება/ })).click();
  await admin.waitForURL(url => /^\/admin\/voice\/[\w-]+$/.test(url.pathname));
  const group = admin.url();
  assert.equal((await fetch(base + "/api/cron/voice", { method: "POST" })).status, 401);
  const result = await fetch(base + "/api/cron/voice", { method: "POST", headers: { Authorization: "Bearer " + cron } });
  assert.ok(result.ok);
  await admin.reload();
  await visible(admin.getByLabel("განხილული ტექსტი")).waitFor();
  await editor.goto(group);
  assert.equal(await editor.getByRole("button", { name: "აღწერის დამტკიცება" }).count(), 0);
  const marker = "სარედაქციო ჯგუფის მიერ შემოწმებული ტექსტი.";
  await visible(editor.getByLabel("განხილული ტექსტი")).fill(marker);
  await visible(editor.getByRole("button", { name: "შესწორების შენახვა" })).click();
  await editor.waitForURL(url => url.hash.startsWith("#item-"));
  await admin.reload();
  assert.equal(await visible(admin.getByLabel("განხილული ტექსტი")).inputValue(), marker);
  await customer.goto(base + "/p/mini-motobloki-agri-ag-3600b");
  assert.ok(!(await visible(customer.locator("article")).innerText()).includes(marker));
  await visible(admin.getByRole("button", { name: "აღწერის დამტკიცება" })).click();
  await visible(admin.locator("summary").filter({ hasText: "დამტკიცებული აღწერების გამოქვეყნება" })).click();
  await visible(admin.getByRole("button", { name: "მონიშნული აღწერების გამოქვეყნება" })).click();
  await admin.waitForURL(url => url.searchParams.get("published") === "1");
  await customer.reload();
  assert.ok((await visible(customer.locator("article")).innerText()).includes(marker));
  console.log("Store voice verified: private generation, mobile editor review, admin approval and public description.");
}
