/** Closed vocabulary: never send or persist a query, product ID, URL, contact
 * information, session or user identifier. Every value is an aggregate count. */
export const DECISION_EVENTS = [
  "search_results", "search_no_results", "search_filtered_empty", "search_corrected",
  "search_reformulated", "search_suggestion_product", "search_suggestion_category", "catalog_filtered_empty",
  "product_view", "product_stock_unknown", "product_price_unknown", "product_out_of_stock",
  "saved_add", "compare_add", "compare_block_type", "compare_block_limit", "compare_block_unknown",
  "compare_ready", "compare_differences", "compare_lookup_failed",
  "cart_add", "cart_stock_unknown", "cart_price_unknown", "cart_unavailable", "cart_price_changed", "cart_qty_adjusted", "cart_quote_failed",
  "checkout_view", "checkout_delivery_unknown", "checkout_method_unavailable", "checkout_submit", "checkout_validation_error", "checkout_server_error",
  "request_form_view", "request_submit", "request_error",
  "search_feedback_yes", "search_feedback_partly", "search_feedback_no",
  "compare_feedback_yes", "compare_feedback_partly", "compare_feedback_no",
  "product_feedback_yes", "product_feedback_partly", "product_feedback_no",
] as const;
export type DecisionEvent = typeof DECISION_EVENTS[number];
export type FeedbackArea = "search" | "compare" | "product";
export type FeedbackAnswer = "yes" | "partly" | "no";
export type Counts = Record<DecisionEvent, number>;
export const isDecisionEvent = (value: unknown): value is DecisionEvent =>
  typeof value === "string" && (DECISION_EVENTS as readonly string[]).includes(value);
export const emptyCounts = (): Counts => Object.fromEntries(DECISION_EVENTS.map(event => [event, 0])) as Counts;
export function searchSignals(total: number, visible: number, corrected: boolean): DecisionEvent[] {
  return [total === 0 ? "search_no_results" : visible === 0 ? "search_filtered_empty" : "search_results",
    ...(corrected ? ["search_corrected" as const] : [])];
}
export function feedbackEvent(area: FeedbackArea, answer: FeedbackAnswer): DecisionEvent {
  return `${area}_feedback_${answer}`;
}
export function feedbackCounts(counts: Counts, area: FeedbackArea) {
  const yes = counts[feedbackEvent(area, "yes")];
  const partly = counts[feedbackEvent(area, "partly")];
  const no = counts[feedbackEvent(area, "no")];
  return { yes, partly, no, total: yes + partly + no };
}
export function summarizeRows(rows: readonly { day: string; event: string; count: number }[]) {
  const totals = emptyCounts();
  const days = new Map<string, Counts>();
  for (const row of rows) {
    if (!isDecisionEvent(row.event) || !Number.isSafeInteger(row.count) || row.count < 0) continue;
    const counts = days.get(row.day) ?? emptyCounts();
    counts[row.event] += row.count;
    totals[row.event] += row.count;
    days.set(row.day, counts);
  }
  return { totals, days: Array.from(days, ([day, counts]) => ({ day, counts })).sort((a, b) => b.day.localeCompare(a.day)) };
}
