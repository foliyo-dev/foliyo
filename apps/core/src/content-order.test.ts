import test from "node:test";
import assert from "node:assert/strict";
import { orderRowsByIds } from "./content-order.js";

test("orderRowsByIds preserves requested id order", () => {
  const rows = [
    { id: "b", name: "Second" },
    { id: "a", name: "First" },
    { id: "c", name: "Third" },
  ];
  assert.deepEqual(orderRowsByIds(rows, ["a", "c", "b"]).map((row) => row.id), ["a", "c", "b"]);
  assert.deepEqual(orderRowsByIds(rows, ["missing"]).length, 0);
});
