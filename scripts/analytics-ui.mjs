import assert from "node:assert/strict";
const visible = locator => locator.filter({ visible: true }).first();
const metricResponse = (r, name) => r.url().endsWith("/api/storefront/decision-events") && r.request().headers()["x-decision-event"] === name;

export async function testAnalytics({ browser, admin, editor, base, productUrl }) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const visitor = await context.newPage();
  try {
    const url = base + "/admin/analytics?days=7&mode=public";
    await admin.goto(url);
    const read = async name => Number((await visible(admin.getByTestId("metric-" + name)).innerText()).replace(/[^0-9]/g, ""));
    const before = await read("search_no_results");
    const beforeFeedback = await read("search_feedback_no");
    const query = "zzqv-private-fixture-98765321";
    const signal = visitor.waitForResponse(r => metricResponse(r, "search_no_results"));
    await visitor.goto(base + "/search?q=" + query);
    const measured = await signal;
    assert.equal(measured.status(), 204);
    assert.equal(measured.request().postData(), null);
    const headers = await measured.request().allHeaders();
    assert.ok(!measured.request().url().includes(query));
    assert.ok(!Object.values(headers).some(v => v.includes(query)), "analytics never sends the query in a header or referrer");
    assert.ok(!headers.cookie, "analytics fetch omits cookies");
    const feedback = visible(visitor.getByTestId("search-decision-feedback"));
    const feedbackSignal = visitor.waitForResponse(r => metricResponse(r, "search_feedback_no"));
    await feedback.locator('[data-answer="no"]').click();
    assert.equal((await feedbackSignal).status(), 204);
    await feedback.getByText("მადლობა, პასუხი დაგვეხმარება მაღაზიის გაუმჯობესებაში.").waitFor();
    await admin.reload();
    assert.equal(await read("search_no_results"), before + 1);
    assert.equal(await read("search_feedback_no"), beforeFeedback + 1);
    await visitor.goto(base + "/info/privacy");
    await visible(visitor.getByTestId("analytics-preference")).click();
    await visible(visitor.getByText("დღიური სტატისტიკა გამორთულია ამ ბრაუზერში.")).waitFor();
    const seen = [];
    visitor.on("request", r => { if (/\/api\/storefront\/(decision-events|description-views)$/.test(r.url())) seen.push(r.url()); });
    await visitor.goto(base + productUrl);
    await visible(visitor.getByTestId("add-to-cart")).waitFor();
    await visitor.waitForTimeout(500);
    assert.equal(await visitor.getByTestId("product-decision-feedback").count(), 0);
    assert.equal(seen.length, 0, "browser opt-out disables new and existing description analytics");
    await visitor.goto(base + "/info/privacy");
    await visible(visitor.getByTestId("analytics-preference")).click();
    await visible(visitor.getByText("დღიური სტატისტიკა ჩართულია.")).waitFor();
    const productSignal = visitor.waitForResponse(r => metricResponse(r, "product_view"));
    await visitor.goto(base + productUrl);
    assert.equal((await productSignal).status(), 204);
    await editor.goto(base + "/admin/analytics");
    await editor.waitForURL(u => u.pathname === "/admin/login");
    await admin.goto(base + "/admin/analytics?days=7&mode=review");
    await visible(admin.getByTestId("analytics-empty")).waitFor();
    assert.equal(await read("search_no_results"), 0);
    console.log("Decision analytics: actual anonymous browser events, feedback, opt-out, admin authorization and review isolation verified.");
  } finally {
    await context.close();
  }
}
