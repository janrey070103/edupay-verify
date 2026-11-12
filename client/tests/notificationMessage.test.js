import test from "node:test";
import assert from "node:assert/strict";
import { displayNotificationMessage } from "../src/utils/notificationMessage.js";

test("legacy notifications omit missing amounts while keeping the approval message", () => {
  assert.equal(
    displayNotificationMessage("Your payment of ₱null for Finals has been approved."),
    "Your payment for Finals has been approved."
  );
  assert.equal(
    displayNotificationMessage("Your payment of ₱2,500.00 for Prelim has been approved."),
    "Your payment of ₱2,500.00 for Prelim has been approved."
  );
});
