import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { Catalog } from "../src/lib/catalog/types";
import { DECISION_TASKS, availableTasks, getDecisionTask, taskScope, tasksForType } from "../src/lib/decisions/tasks";
import { isDecisionEvent } from "../src/lib/analytics/model";
import { applyQuery, parseQuery } from "../src/lib/catalog/filters";

const catalog = JSON.parse(readFileSync(new URL("../data/catalog.json", import.meta.url), "utf8")) as Catalog;

test("starter tasks have stable closed identifiers, practical checks and known anonymous metrics", () => {
  assert.equal(new Set(DECISION_TASKS.map(task => task.id)).size, DECISION_TASKS.length);
  for (const task of DECISION_TASKS) {
    assert.equal(getDecisionTask(task.id), task);
    assert.equal(task.questions.length, 3);
    assert.ok(task.caution.trim());
    assert.ok(isDecisionEvent(task.event));
  }
  assert.equal(getDecisionTask("constructor"), undefined);
  assert.equal(getDecisionTask("unknown"), undefined);
});

test("task scopes only contain visible catalog products in declared, existing types", () => {
  const choices = availableTasks(catalog);
  assert.ok(choices.some(row => row.task.id === "soil"));
  for (const { task, count } of choices) {
    const scope = taskScope(task, catalog);
    assert.equal(scope.products.length, count);
    assert.equal(scope.groups.reduce((sum, group) => sum + group.count, 0), count);
    assert.ok(scope.products.every(p => p.visible && task.types.includes(p.product_type)));
  }
  const soil = getDecisionTask("soil")!;
  const scope = taskScope(soil, catalog);
  assert.ok(scope.products.length > 0);
  assert.ok(scope.products.every(p => p.product_type === "MOTOBLOCK"));
  assert.deepEqual(tasksForType("MOTOBLOCK").map(t => t.id), ["soil"]);
  assert.deepEqual(tasksForType("unknown"), []);
  assert.equal(taskScope(soil, { ...catalog, product_types: [] }).products.length, 0);
  assert.equal(availableTasks({ ...catalog, products: [] }).length, 0);
  const hidden = scope.products[0];
  const without = taskScope(soil, { ...catalog, products: catalog.products.map(p => p.id === hidden.id ? { ...p, visible: false } : p) });
  assert.ok(!without.products.some(p => p.id === hidden.id));
});

test("filters cannot widen a work scope or silently turn a missing price into zero", () => {
  const scope = taskScope(getDecisionTask("soil")!, catalog);
  const query = parseQuery({ type: "GENERATOR" }, catalog);
  assert.deepEqual(applyQuery(scope.products, query, catalog), []);
  const withUnknown = [{ ...scope.products[0], price: { currency: "GEL" as const, base: null, promo: null } }];
  assert.deepEqual(applyQuery(withUnknown, parseQuery({ price_to: "0" }, catalog), catalog), []);
});
