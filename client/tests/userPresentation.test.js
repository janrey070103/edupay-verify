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

test("names display surname first and older single-field names stay readable", async () => {
  const { formatLastFirst, splitLegacyName } = await import("../src/utils/userPresentation.js");
  assert.equal(formatLastFirst({ firstName: "Juan", middleName: "Santos", lastName: "Dela Cruz" }), "Dela Cruz, Juan Santos");
  assert.equal(formatLastFirst({ firstName: "Ana", lastName: "Reyes" }), "Reyes, Ana");
  assert.equal(formatLastFirst({ name: "Legacy Person" }), "Legacy Person");
  assert.deepEqual(splitLegacyName("Maria Clara Santos"), { firstName: "Maria Clara", middleName: "", lastName: "Santos" });
});

test("dashboard card wording names the terms, amounts and waiting time", async () => {
  const { termList, waitingSince, mergeDetails, peso } = await import("../src/utils/summaryText.js");
  assert.equal(termList(["Prelim", "PreFinal"]), "Prelim · Pre‑Final");
  assert.equal(termList([]), "No term selected");
  const now = new Date("2026-11-12T08:00:00Z");
  assert.equal(waitingSince("2026-11-12T01:00:00Z", now), "oldest submitted today");
  assert.equal(waitingSince("2026-11-09T07:00:00Z", now), "oldest waiting 3 days");
  const merged = mergeDetails({ count: 2, amount: 5000, noAmount: 0, terms: ["Prelim"], oldest: "2026-11-10" },
    { count: 1, amount: 0, noAmount: 1, terms: ["Midterm"], oldest: "2026-11-08" });
  assert.deepEqual({ ...merged, oldest: String(merged.oldest) },
    { count: 3, amount: 5000, noAmount: 1, terms: ["Prelim", "Midterm"], oldest: "2026-11-08" });
  assert.match(peso(5000), /5,000/);
});

test("payment modes include M Lhuillier and summarise the review queue", async () => {
  const { PAYMENT_CHANNELS, channelShort, channelBreakdown } = await import("../src/utils/paymentChannels.js");
  assert.deepEqual(PAYMENT_CHANNELS.map((item) => item.value), ["palawan", "mlhuillier", "online", "bank"]);
  assert.equal(channelShort("mlhuillier"), "M Lhuillier");
  assert.equal(channelBreakdown({ palawan: 2, mlhuillier: 1, unspecified: 3 }), "Palawan 2 · M Lhuillier 1 · Not specified 3");
  assert.equal(channelBreakdown({}), "");
});

test("exam permit windows read as plain dates", async () => {
  const { windowRange, windowSummary, windowOpen } = await import("../src/utils/examWindowText.js");
  const window = { state: "upcoming", start: "2026-07-31T16:00:00.000Z", end: "2026-08-31T15:59:59.999Z" };
  assert.match(windowRange(window), /Aug 1 – Aug 31, 2026/);
  assert.match(windowSummary(window), /QR usable Aug 1 – Aug 31, 2026/);
  assert.equal(windowOpen(window), false);
  assert.equal(windowOpen({ state: "open" }), true);
  assert.equal(windowOpen({ state: "anytime" }), true);
  assert.match(windowSummary({ state: "unknown" }), /ask the Admin/);
});

test("exam time: picked times become schedule text; manual text allowed", async () => {
  const { to12h, scheduleFromTimes, examTimeProblem } = await import("../src/utils/examTime.js");
  assert.equal(to12h("00:15"), "12:15 AM");
  assert.equal(to12h("13:30"), "1:30 PM");
  assert.equal(scheduleFromTimes("09:00", "11:00"), "9:00 AM – 11:00 AM");
  assert.equal(examTimeProblem({ timeMode: "picker", startTime: "09:00", endTime: "11:00" }), null);
  assert.match(examTimeProblem({ timeMode: "picker", startTime: "11:00", endTime: "09:00" }), /after the start/);
  assert.match(examTimeProblem({ timeMode: "picker", startTime: "09:00" }), /start and end/);
  assert.equal(examTimeProblem({ timeMode: "manual", schedule: "After lunch, TBA" }), null);
  assert.match(examTimeProblem({ timeMode: "manual", schedule: " " }), /Type the exam time/);
});
