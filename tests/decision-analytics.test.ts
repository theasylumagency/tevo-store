import assert from "node:assert/strict";
import test from "node:test";
import { feedbackCounts, isDecisionEvent, searchSignals, summarizeRows } from "../src/lib/analytics/model";

test("search outcome is mutually exclusive, and correction is an independent signal", () => {
  assert.deepEqual(searchSignals(0, 0, false), ["search_no_results"]);
  assert.deepEqual(searchSignals(4, 0, true), ["search_filtered_empty", "search_corrected"]);
  assert.deepEqual(searchSignals(4, 2, true), ["search_results", "search_corrected"]);
});
test("summaries count events, not users, and never interpret absent feedback as a negative answer", () => {
  const { totals, days } = summarizeRows([
    { day: "2026-11-27", event: "search_results", count: 6 },
    { day: "2026-11-28", event: "search_results", count: 2 },
    { day: "2026-11-28", event: "search_feedback_yes", count: 1 },
    { day: "2026-11-28", event: "search_feedback_partly", count: 2 },
    { day: "2026-11-28", event: "private query", count: 999 },
  ]);
  assert.equal(totals.search_results, 8);
  assert.deepEqual(feedbackCounts(totals, "search"), { yes: 1, partly: 2, no: 0, total: 3 });
  assert.deepEqual(feedbackCounts(totals, "compare"), { yes: 0, partly: 0, no: 0, total: 0 });
  assert.equal(days[0].day, "2026-11-28");
  assert.equal(isDecisionEvent("private query"), false);
});
