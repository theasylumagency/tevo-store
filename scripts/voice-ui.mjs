import assert from "node:assert/strict";

const visible = locator => locator.filter({ visible: true }).first();
export async function testVoice({ admin, editor, customer, base, cron }) {
  const target = "at-8425";
  const tick = () => fetch(base + "/api/cron/voice", { method: "POST", headers: { Authorization: "Bearer " + cron } });
  await admin.goto(base + "/admin/voice");
  await visible(admin.getByRole("radio", { name: /თქვენობითი/ })).check();
  await visible(admin.getByRole("button", { name: /^ტექნიკური/ })).click();
  assert.ok(await visible(admin.getByRole("radio", { name: /თქვენობითი/ })).isChecked(), "a tone preset keeps the store's address form");
  await visible(admin.locator("summary").filter({ hasText: "ხმის ტექსტის ჩასწორება" })).click();
  await visible(admin.getByLabel("როგორ ვწერთ")).fill("მოკლედ და გასაგებად.");
  await visible(admin.getByLabel("საცდელი პროდუქტი 1")).selectOption(target);
  await visible(admin.getByRole("button", { name: "მოამზადე 3 საცდელი აღწერა" })).click();
  await admin.waitForURL(url => /^\/admin\/voice\/[\w-]+$/.test(url.pathname));
  const trial = admin.url();
  assert.equal((await fetch(base + "/api/cron/voice", { method: "POST" })).status, 401);
  assert.equal((await (await tick()).json()).processed, 3);
  await admin.reload();
  await visible(admin.getByRole("heading", { name: "სამი ნიმუში ერთად" })).waitFor();
  await visible(admin.getByText(/რომელი ფაქტი ეხმარება მყიდველს/)).waitFor();
  assert.equal(await admin.getByRole("button", { name: "აღწერის დამტკიცება" }).count(), 0);
  await editor.goto(trial);
  assert.equal(await editor.getByRole("button", { name: "დაამტკიცე მაღაზიის ხმა" }).count(), 0);
  const ack = visible(admin.locator('input[name="ack"]'));
  if (await ack.count()) await ack.check();
  await visible(admin.getByRole("button", { name: "დაამტკიცე მაღაზიის ხმა" })).click();
  await admin.waitForURL(url => url.searchParams.has("approved"));
  await visible(admin.getByRole("button", { name: "მოამზადე კატალოგის აღწერები ამ ხმით" })).click();
  await admin.waitForURL(url => /^\/admin\/voice\/[\w-]+$/.test(url.pathname));
  const group = admin.url();
  for (let i = 0; i < 300; i++) {
    const response = await tick();
    assert.ok(response.ok);
    if (!(await response.json()).processed) break;
  }
  await admin.reload();
  await visible(admin.getByText("აღწერები მზადაა გადასახედად.", { exact: true })).waitFor();
  const findItem = async page => {
    // Groups may span pages; locate the actual SKU instead of assuming insertion order.
    for (let i = 0; i < 40; i++) {
      const item = visible(page.locator('article[id^="item-"]').filter({ has: page.getByRole("link", { name: target, exact: true }) }));
      if (await item.count()) return item;
      await visible(page.getByRole("link", { name: "შემდეგი", exact: true })).click();
      await page.waitForURL(url => url.searchParams.get("page") === String(i+2));
    }
    throw Error("Missing SKU on review pages");
  };
  await editor.goto(group);
  const editable = await findItem(editor);
  const itemId = await editable.getAttribute("id");
  const editUrl = editor.url();
  const marker = "სარედაქციო ჯგუფის მიერ შემოწმებული ტექსტი.";
  await editable.getByLabel("განხილული ტექსტი").fill(marker);
  await editable.getByRole("button", { name: "შესწორების შენახვა" }).click();
  await editor.waitForURL(url => url.hash.startsWith("#item-"));
  await admin.goto(editUrl);
  const item = visible(admin.locator("#" + itemId));
  assert.equal(await item.getByLabel("განხილული ტექსტი").inputValue(), marker);
  await customer.goto(base + "/p/mini-motobloki-agri-ag-3600b");
  assert.ok(!(await visible(customer.locator("article")).innerText()).includes(marker));
  const check = item.locator('input[name="ack"]');
  if (await check.count()) await check.check();
  await item.getByRole("button", { name: "აღწერის დამტკიცება" }).click();
  await admin.waitForURL(url => url.hash.startsWith("#item-"));
  await visible(admin.locator("summary").filter({ hasText: "გადამოწმებული კატალოგის გამოქვეყნება" })).click();
  const form = visible(admin.locator("form").filter({ has: admin.getByRole("button", { name: "მონიშნული აღწერების გამოქვეყნება" }) }));
  const expected = itemId.slice(5) + ":";
  // Select only the one product reviewed in this scenario.
  await form.locator('input[name="version"]').evaluateAll((boxes, prefix) => {
    for (const box of boxes) box.checked = box.value.startsWith(prefix);
  }, expected);
  await form.getByRole("button", { name: "მონიშნული აღწერების გამოქვეყნება" }).click();
  await admin.waitForURL(url => url.searchParams.get("published") === "1");
  const event = (response, kind) => response.url().endsWith("/api/storefront/description-views") &&
    response.request().headers()["x-description-event"] === kind;
  const opened = customer.waitForResponse(r => event(r, "open"));
  await customer.reload();
  assert.ok((await opened).ok());
  assert.ok((await visible(customer.locator("article")).innerText()).includes(marker));
  const exposed = customer.waitForResponse(r => event(r, "exposed"));
  await visible(customer.getByText(marker, { exact: true })).scrollIntoViewIfNeeded();
  assert.equal((await exposed).status(), 204);
  await admin.goto(base + "/admin/voice");
  await visible(admin.getByText(/ეკრანზე ზედიზედ 3 წამით გამოჩნდა [1-9]/)).waitFor();
  console.log("Voice verified: one audition, admin-only adoption, catalog review, editor and explicit publication.");
}
