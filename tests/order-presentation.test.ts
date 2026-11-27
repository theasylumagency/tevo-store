import assert from "node:assert/strict";
import test from "node:test";
import { customerOrderPresentation } from "../src/lib/orders/presentation";

test("cancelled and completed orders never use the newly received acknowledgement", () => {
  for (const status of ["cancelled", "completed", "confirmed", "shipped", "ready_for_pickup"]) {
    for (const paymentStatus of ["unpaid", "paid", "failed", "refunded"]) {
      const presentation = customerOrderPresentation({ status, paymentStatus, paymentMethod: "card" });
      assert.equal(presentation.received, false, `${status}/${paymentStatus}`);
      assert.equal(presentation.canRetryPayment, false, `${status}/${paymentStatus}`);
      assert.doesNotMatch(presentation.title, /შეკვეთა მიღებულია/);
    }
  }
  assert.equal(customerOrderPresentation({ status: "new", paymentStatus: "unpaid", paymentMethod: "cash" }).received, true);
});

test("payment retry is exposed only for a failed online payment on a pending order", () => {
  for (const paymentMethod of ["card", "installment"]) {
    assert.equal(customerOrderPresentation({ status: "pending_payment", paymentStatus: "failed", paymentMethod }).canRetryPayment, true);
    for (const paymentStatus of ["unpaid", "pending", "paid", "refunded"]) {
      assert.equal(customerOrderPresentation({ status: "pending_payment", paymentStatus, paymentMethod }).canRetryPayment, false);
    }
  }
  assert.equal(customerOrderPresentation({ status: "pending_payment", paymentStatus: "failed", paymentMethod: "cash" }).canRetryPayment, false);
});

test("cancellation does not claim a refund before the payment status confirms it", () => {
  const paid = customerOrderPresentation({ status: "cancelled", paymentStatus: "paid", paymentMethod: "card" });
  const refunded = customerOrderPresentation({ status: "cancelled", paymentStatus: "refunded", paymentMethod: "card" });
  assert.doesNotMatch(paid.detail, /დაბრუნება შესრულებულია/);
  assert.match(refunded.detail, /დაბრუნება შესრულებულია/);
  assert.equal(paid.tone, "neutral");
});
