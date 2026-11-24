// End-to-end check of the order flow against a running store (PAYMENTS_MODE=test).
//   BASE_URL=http://localhost:3000 ADMIN_PASSWORD=… OUTBOX_TOKEN=… CHROME_PATH=/usr/bin/google-chrome npm run test:e2e
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const PRODUCT = process.env.E2E_PRODUCT ?? "/p/motobloki-hiromiki-mq170gs";
const results = [];
const check = (name, ok, extra = "") => { results.push({ name, ok }); console.log(`${ok ? "✓" : "✗"} ${name}${extra ? "  " + extra : ""}`); };

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
// Next keeps previously visited pages mounted but hidden (state preservation), so always target the visible copy
const vis = (sel) => page.locator(sel).locator("visible=true").first();
const click = (sel) => vis(sel).click();
const text = (sel) => vis(sel).textContent();
const shot = (n) => process.env.E2E_SHOTS && page.screenshot({ path: `${process.env.E2E_SHOTS}/${n}.png`, fullPage: true });

try {
  // 1. add to cart
  await page.goto(BASE + PRODUCT);
  await page.fill("#qty", "2");
  await click("[data-testid=add-to-cart]");
  await page.waitForSelector("[data-testid=cart-count]");
  check("cart badge shows 2", (await text("[data-testid=cart-count]")) === "2");

  // 2. cart page re-quotes on the server
  await page.goto(BASE + "/cart");
  await page.waitForSelector("[data-testid=cart-total]");
  const cartTotal = (await text("[data-testid=cart-total]")).replace(/[\s,]/g, "");
  check("cart total is 2 × price", /2598/.test(cartTotal), cartTotal);
  await shot("1-cart");

  // 3. checkout validation
  await click("[data-testid=go-checkout]");
  await page.waitForSelector("[data-testid=place-order]:not([disabled])");
  await page.fill("input[name=name]", "ტესტი ტესტიშვილი");
  await page.fill("input[name=phone]", "12345");
  await click("[data-testid=place-order]");
  await page.waitForSelector("text=ტელეფონის ნომერი არასწორია");
  check("invalid phone and missing address are rejected", (await page.locator("text=შეავსე ეს ველი").count()) >= 2);

  // 4. card payment: bank declines, then retry succeeds
  await page.fill("input[name=phone]", "599 12 34 56");
  await page.selectOption("select[name=region]", "მცხეთა-მთიანეთი");
  await page.fill("input[name=city]", "მცხეთა");
  await page.fill("input[name=address]", "აღმაშენებლის 1");
  await shot("2-checkout");
  await click("[data-testid=place-order]");
  await page.waitForURL(/\/pay\/mock\//);
  check("card order goes to the (test) bank", true, page.url().replace(BASE, ""));
  await click("[data-testid=mock-fail]");
  await page.waitForURL(/\/order\//);
  await page.waitForSelector("[data-testid=retry-payment]");
  check("declined payment offers a retry", true);
  const orderUrl1 = page.url();
  check("cart is emptied after placing the order", (await page.locator("[data-testid=cart-count]").count()) === 0);
  await click("[data-testid=retry-payment]");
  await page.waitForURL(/\/pay\/mock\//);
  await click("[data-testid=mock-success]");
  await page.waitForSelector("[data-testid=order-thanks]");
  const status1 = await text("[data-testid=order-status]");
  check("paid order becomes 'ახალი' and shows paid", status1.includes("ახალი") && (await page.locator("text=გადახდილი").count()) > 0);
  const number1 = (await text("[data-testid=order-number]")).replace(/.*\s/, "");
  await shot("3-order-paid");

  // 5. wrong token never shows the order
  await page.goto(orderUrl1.replace(/t=[^&]+/, "t=wrong"));
  check("order page needs the secret link", (await page.locator("text=შეკვეთა ვერ მოიძებნა").count()) > 0);

  // 6. cash + pickup order
  await page.goto(BASE + PRODUCT);
  await click("[data-testid=add-to-cart]");
  await page.goto(BASE + "/checkout");
  await page.waitForSelector("[data-testid=place-order]:not([disabled])");
  await page.fill("input[name=name]", "მეორე მყიდველი");
  await page.fill("input[name=phone]", "+995 577 00 11 22");
  await page.check("input[name=deliveryMethod][value=pickup]");
  await page.check("input[name=paymentMethod][value=cash]");
  await click("[data-testid=place-order]");
  await page.waitForSelector("[data-testid=order-thanks]");
  check("cash order is placed without a bank", (await text("[data-testid=order-status]")).includes("ახალი"));

  // 7. admin
  await page.goto(BASE + "/admin");
  await page.waitForURL(/\/admin\/login/);
  await page.fill("input[name=password]", "wrong-password");
  await click("button:has-text('შესვლა')");
  await page.waitForSelector("text=პაროლი არასწორია");
  check("admin rejects a wrong password", true);
  await page.fill("input[name=password]", process.env.ADMIN_PASSWORD ?? "");
  await click("button:has-text('შესვლა')");
  await page.waitForSelector("[data-testid=orders-table]");
  check("admin lists the orders", (await page.locator("[data-testid=orders-table] tbody tr").count()) >= 2);
  await shot("4-admin-list");
  await click(`a:has-text('${number1}')`);
  for (const s of ["confirmed", "shipped", "completed"]) {
    await click(`[data-testid=to-${s}]`);
    await page.waitForSelector(`[data-testid=admin-status]:has-text('${{ confirmed: "დადასტურებული", shipped: "გაგზავნილია", completed: "დასრულებული" }[s]}')`);
  }
  check("admin walks the order to 'დასრულებული'", (await page.locator("text=ეს შეკვეთა დასრულებულია").count()) > 0);
  await shot("5-admin-order");

  // 8. Khidi outbox
  const unauth = await fetch(BASE + "/api/outbox/orders");
  check("outbox refuses without token", unauth.status === 401);
  const auth = { Authorization: `Bearer ${process.env.OUTBOX_TOKEN}` };
  const out = await (await fetch(BASE + "/api/outbox/orders", { headers: auth })).json();
  check("outbox returns paid + cash orders without access tokens",
        out.orders.length >= 2 && out.orders.every((o) => !("accessToken" in o) && o.items.length > 0));
  const ack = await (await fetch(BASE + "/api/outbox/orders", { method: "POST", headers: { ...auth, "content-type": "application/json" },
                                                               body: JSON.stringify({ ids: out.orders.map((o) => o.id) }) })).json();
  const after = await (await fetch(BASE + "/api/outbox/orders", { headers: auth })).json();
  check("acknowledged orders leave the outbox", ack.acknowledged === out.orders.length && after.orders.length === 0);

  // 9. repeated bank callbacks are harmless
  const repeat = await fetch(BASE + "/api/payments/mock/callback", { method: "POST", headers: { "content-type": "application/json" },
                                                                     body: JSON.stringify({ paymentId: "00000000-0000-0000-0000-000000000000", outcome: "succeeded" }) });
  check("callback for an unknown payment is ignored", repeat.status === 200);
} catch (e) {
  check("flow completed without errors", false, String(e).split("\n")[0]);
  await shot("error");
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
