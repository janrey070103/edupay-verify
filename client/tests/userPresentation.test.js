import test from "node:test";
import assert from "node:assert/strict";
import { sortUsersByName, formatCreatedPH } from "../src/utils/userPresentation.js";

test("users sort by full name in both directions without mutating API data", () => {
  const users = [{ name: "Zeta" }, { name: "ana" }, { name: "Ben" }];
  assert.deepEqual(sortUsersByName(users).map((user) => user.name), ["ana", "Ben", "Zeta"]);
  assert.deepEqual(sortUsersByName(users, "desc").map((user) => user.name), ["Zeta", "Ben", "ana"]);
  assert.equal(users[0].name, "Zeta");
});

test("creation timestamps render in Philippine time and missing history stays unknown", () => {
  assert.match(formatCreatedPH("2026-10-08T00:00:00.000Z"), /8:00/);
  assert.equal(formatCreatedPH(null), "Unknown");
});
