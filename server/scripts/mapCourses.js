// Course clean-up for accounts created before the course catalogue existed.
//
//   node scripts/mapCourses.js                read-only: lists typed course values
//                                             that are not exact catalogue codes, with
//                                             a suggested code where one clearly matches
//   node scripts/mapCourses.js --apply-auto   applies only the clear matches
//                                             (e.g. "BPED" / "b.p.ed" -> "BPEd")
//   node scripts/mapCourses.js --apply map.json
//                                             applies a reviewed mapping,
//                                             e.g. { "BS Info Tech": "BSIT" }
//
// Back up the database before any --apply. Unmatched students are not shown to
// any Admin; fix them here or in User Management ("Course not in list").
require("dotenv").config();
const fs = require("fs");
const mongoose = require("mongoose");
const { COURSES } = require("../config/catalog");

const normalize = (value) => String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

async function main() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required.");
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  const users = mongoose.connection.collection("users");
  const codes = [...new Set([...COURSES.map((course) => course.code),
    ...(await mongoose.connection.collection("courses").distinct("code"))])];
  const exact = new Set(codes);
  const suggest = (value) => codes.find((code) => normalize(code) === normalize(value)) || null;

  const rows = (await users.aggregate([
    { $match: { role: "student" } },
    { $group: { _id: "$course", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]).toArray()).filter((row) => !exact.has(row._id));

  const update = async (from, to) => {
    const result = await users.updateMany({ role: "student", course: from }, { $set: { course: to } });
    console.log(`${JSON.stringify(from)} -> ${to}: ${result.modifiedCount} updated`);
  };

  if (process.argv.includes("--apply-auto")) {
    for (const row of rows) {
      const code = suggest(row._id);
      if (code) await update(row._id, code);
    }
    return;
  }

  const applyIndex = process.argv.indexOf("--apply");
  if (applyIndex !== -1) {
    const mapping = JSON.parse(fs.readFileSync(process.argv[applyIndex + 1], "utf8"));
    for (const [from, to] of Object.entries(mapping)) {
      if (!exact.has(to)) { console.log(`Skipped ${JSON.stringify(from)}: "${to}" is not a catalogue code.`); continue; }
      await update(from, to);
    }
    return;
  }

  console.log(`Course values that are not exact catalogue codes: ${rows.length}`);
  rows.forEach((row) => {
    const code = suggest(row._id);
    console.log(`  ${JSON.stringify(row._id ?? null)}: ${row.count} student(s)${code ? `  -> suggested ${code}` : "  -> no match, map manually"}`);
  });
  console.log("\n--apply-auto applies the suggestions; --apply <file> applies a manual mapping.");
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
