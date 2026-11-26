// End-to-end check of the order flow against a running store (PAYMENTS_MODE=test).
//   (start the mocks with SMS_FAIL_CALL=2 to exercise the retry check)
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
  // 0. routing & caching: real 404s for unknown slugs, pages survive a cache refresh (POST /api/revalidate)
  const status = async (u) => (await fetch(BASE + u)).status;
  check("health endpoint is ok", (await (await fetch(BASE + "/api/health")).json()).ok === true);
  const unknown = await Promise.all(["/p/no-such-product", "/catalog/no-such", "/catalog/agri-machinery/no-such", "/info/no-such"].map(status));
  check("unknown product/category/legal slugs are HTTP 404", unknown.every((s) => s === 404), unknown.join(","));
  const rv = await fetch(BASE + "/api/revalidate", { method: "POST", headers: { Authorization: `Bearer ${process.env.CRON_TOKEN}` } });
  const refreshed = await Promise.all([PRODUCT, "/catalog/agri-machinery", "/catalog/agri-machinery/motoblock", "/info/terms", "/"].map(status));
  check("pages still render after a cache refresh", rv.ok && refreshed.every((s) => s === 200), refreshed.join(","));

  // 0b. admin settings + Telegram (separate browser context, so the shop session below starts clean)
  const MOCKS = Boolean(process.env.MOCK_LOG_URL);
  const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const ap = await adminCtx.newPage();
  const av = (sel) => ap.locator(sel).locator("visible=true").first();
  await ap.goto(BASE + "/admin/settings");
  await ap.waitForURL(/\/admin\/login/);
  await ap.fill("input[name=password]", process.env.ADMIN_PASSWORD ?? "");
  await av("button:has-text('შესვლა')").click();
  await ap.waitForSelector("[data-testid=settings-form]");
  await ap.fill("input[name='legal.name']", "შპს „ტესტ ტრეიდი“");
  await ap.fill("input[name='legal.idCode']", "123");
  await av("[data-testid=settings-form] button:has-text('შენახვა')").click();
  await ap.waitForSelector("text=შეამოწმეთ მონიშნული ველები");
  check("settings reject an invalid ID code", (await ap.locator("input[name='legal.idCode'][aria-invalid=true]").count()) === 1);
  await ap.fill("input[name='legal.idCode']", "405123456");
  await ap.fill("input[name='legal.legalAddress']", "თბილისი, ტესტის ქ. 1");
  await ap.fill("input[name='contact.phone']", "032 2 00 00 00");
  await ap.fill("input[name='contact.email']", "info@example.com");
  await av("[data-testid=settings-form] button:has-text('შენახვა')").click();
  await ap.waitForSelector("[role=status]:has-text('შენახულია')");
  const contactHtml = await (await fetch(BASE + "/info/contact")).text();
  const termsHtml = await (await fetch(BASE + "/info/terms")).text();
  check("saved contacts appear on the legal pages and in the footer",
        contactHtml.includes("032 2 00 00 00") && contactHtml.includes("info@example.com") && termsHtml.includes("405123456")
        && /data-testid="footer-contact"[^]*032 2 00 00 00/.test(contactHtml));

  let tgSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const hook = (body, secret = tgSecret) => fetch(BASE + "/api/telegram/webhook", { method: "POST",
    headers: { "content-type": "application/json", ...(secret ? { "x-telegram-bot-api-secret-token": secret } : {}) }, body: JSON.stringify(body) });
  const newLink = async () => {
    await av("button:has-text('დაკავშირების ბმულის შექმნა')").click();
    const a = av("[data-testid=tg-link] a");
    await a.waitFor();
    const href = await a.getAttribute("href");
    await ap.reload(); await ap.waitForSelector("[data-testid=settings-form]");
    return new URL(href).searchParams.get("start");
  };
  if (MOCKS && tgSecret) {
    if ((await av("[data-testid=tg-webhook]").textContent()).includes("ჯერ")) {
      await av("button:has-text('ბოტის ჩართვა')").click();
      await ap.waitForSelector("[role=status]:has-text('ბოტი იღებს')");
    }
    await ap.reload();
    check("Telegram webhook is registered from the admin", (await av("[data-testid=tg-webhook]").textContent()).includes("იღებს"));
    const code = await newLink();
    check("webhook refuses requests without the secret", (await hook({}, "wrong-secret-0123456789")).status === 401);
    await hook({ message: { chat: { id: 777, type: "private", first_name: "ნინო" }, text: `/start ${code}` } });
    await hook({ message: { chat: { id: 888, type: "private", first_name: "უცხო" }, text: `/start ${code}` } });   // reused code
    const code2 = await newLink();
    await hook({ message: { chat: { id: 403, type: "group", title: "დაბლოკილი ჯგუფი" }, text: `/start@rodo_test_bot ${code2}` } });
    await ap.reload();
    const chats = await av("[data-testid=tg-chats]").textContent();
    check("staff chats connect with a one-time link", chats.includes("ნინო") && chats.includes("დაბლოკილი ჯგუფი") && !chats.includes("უცხო"));
  }

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
  check("ordering without accepting the terms is refused", (await page.locator("text=საჭიროა თანხმობა").count()) > 0);

  // 4. card payment: bank declines, then retry succeeds
  await page.fill("input[name=phone]", "599 12 34 56");
  await page.selectOption("select[name=region]", "მცხეთა-მთიანეთი");
  await page.fill("input[name=city]", "მცხეთა");
  await page.fill("input[name=address]", "აღმაშენებლის 1");
  await page.fill("input[name=email]", "buyer@example.com");
  await page.check("[data-testid=terms]");
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
  const denied = await page.locator("text=შეკვეთა ვერ მოიძებნა").first().waitFor({ timeout: 5000 }).then(() => true, () => false);
  check("order page needs the secret link", denied && (await page.locator("[data-testid=order-number]:visible").count()) === 0);

  // 6. cash + pickup order
  await page.goto(BASE + PRODUCT);
  await click("[data-testid=add-to-cart]");
  await page.goto(BASE + "/checkout");
  await page.waitForSelector("[data-testid=place-order]:not([disabled])");
  await page.fill("input[name=name]", "მეორე მყიდველი");
  await page.fill("input[name=phone]", "+995 577 00 11 22");
  await page.check("input[name=deliveryMethod][value=pickup]");
  await page.check("input[name=paymentMethod][value=cash]");
  await page.check("[data-testid=terms]");
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
  check("admin shows the order's notifications", (await page.locator("[data-testid=admin-notifications] li").count()) >= 3);
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
  // 10. notifications (only when the mock SMS/SMTP servers are running)
  if (process.env.MOCK_LOG_URL) {
    await page.waitForTimeout(1500);
    await fetch(BASE + "/api/cron/notifications", { method: "POST", headers: { Authorization: `Bearer ${process.env.CRON_TOKEN}` } });
    await page.waitForTimeout(1000);
    const log = await (await fetch(process.env.MOCK_LOG_URL)).json();
    const toBuyer = log.sms.filter((m) => m.to === "995599123456");
    const okTexts = toBuyer.filter((m) => m.ok).map((m) => m.text);
    const paidSms = toBuyer.filter((m) => m.text.includes("გადახდილია"));
    check("paid order: SMS with number and short link", okTexts.some((x) => x.includes(number1) && x.includes("გადახდილია") && /\/o\/[0-9A-Za-z]{8}/.test(x)));
    check("gateway error is retried by the cron runner", paidSms.length === 2 && !paidSms[0].ok && paidSms[1].ok);
    check("declined payment: exactly one SMS", okTexts.filter((x) => x.includes("ვერ შესრულდა")).length === 1);
    check("status SMS for confirmed and shipped, silence on completed",
          okTexts.some((x) => x.includes("დადასტურდა")) && okTexts.some((x) => x.includes("გამოგზავნილია")) && !okTexts.some((x) => x.includes("დასრულ")));
    check("SMS are sent as transactional (urgent)", log.sms.every((m) => m.urgent === "true"));
    const staff = log.email.filter((m) => m.to.includes("staff@example.com"));
    check("staff e-mail for the paid and the cash order", staff.length === 2 && staff.every((m) => m.subject.includes("ახალი შეკვეთა")));
    const buyerMail = log.email.filter((m) => m.to.includes("buyer@example.com"));
    check("customer e-mails: paid + confirmed + shipped, HTML", buyerMail.length === 3 && buyerMail.every((m) => m.hasHtml));
    const code = /\/o\/([0-9A-Za-z]{8})/.exec(okTexts.find((x) => x.includes(number1)) ?? "")?.[1];
    const r = await fetch(`${BASE}/o/${code}`, { redirect: "manual" });
    check("short link leads to the order page", [302, 303, 307, 308].includes(r.status) && /\/order\/.+\?t=/.test(r.headers.get("location") ?? ""));
    check("unknown short link is 404", (await fetch(`${BASE}/o/AAAAAAAA`, { redirect: "manual" })).status === 404);
    if (tgSecret) {
      const tgTo = (chat) => log.telegram.filter((m) => m.method === "sendMessage" && m.chat === chat);
      check("Telegram: linking is confirmed, a reused link is refused",
            tgTo("777").some((m) => m.text.includes("დაკავშირებულია")) && tgTo("888").some((m) => m.text.includes("ვადაგასულია")));
      const orderMsgs = tgTo("777").filter((m) => m.text.includes("ახალი შეკვეთა"));
      check("Telegram: staff get the paid and the cash order (HTML, phone, total)",
            orderMsgs.length === 2 && orderMsgs.some((m) => m.text.includes(number1)) && orderMsgs.every((m) => m.parse_mode === "HTML" && m.text.includes("+995")));
      await ap.reload();
      const li = await av("[data-testid=tg-chats] li:has-text('დაბლოკილი ჯგუფი')").textContent();
      check("Telegram: a chat that blocked the bot is disconnected automatically", li.includes("გათიშულია"));
    }
  }
} catch (e) {
  check("flow completed without errors", false, String(e).split("\n")[0]);
  await shot("error");
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
