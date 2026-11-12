import test from "node:test";
import assert from "node:assert/strict";
import { singleScanCallback } from "../src/utils/singleScan.js";

test("one camera start accepts one QR even when the reader reports repeated frames", () => {
  const scanned = [];
  let stops = 0;
  const controls = { stop: () => { stops += 1; } };
  const callback = singleScanCallback(() => true, (value) => scanned.push(value));
  const result = { getText: () => "same-qr" };
  callback(undefined, undefined, controls);
  callback(result, undefined, controls);
  callback(result, undefined, controls);
  assert.deepEqual(scanned, ["same-qr"]);
  assert.equal(stops, 1);
});

test("a stopped camera ignores late QR callbacks", () => {
  let current = true;
  let scanned = false;
  const callback = singleScanCallback(() => current, () => { scanned = true; });
  current = false;
  callback({ getText: () => "late-qr" }, undefined, { stop: () => assert.fail("Stopped again") });
  assert.equal(scanned, false);
});
