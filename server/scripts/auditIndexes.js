// Read-only preflight for new unique student/ledger indexes. Run with MONGO_URI.
require("dotenv").config();
const mongoose = require("mongoose");

async function countDuplicateGroups(collection, match) {
  const result = await collection.aggregate([
    { $match: match },
    { $group: { _id: "$studentId", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $count: "groups" },
  ]).toArray();
  return result[0]?.groups || 0;
}

async function main() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required.");
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
  const users = await countDuplicateGroups(mongoose.connection.collection("users"),
    { role: "student", studentId: { $type: "string" } });
  const ledgers = await countDuplicateGroups(mongoose.connection.collection("ledgers"),
    { studentId: { $type: "string" } });
  console.log(`Duplicate student ID groups: ${users}`);
  console.log(`Duplicate ledger ID groups: ${ledgers}`);
  if (users || ledgers) process.exitCode = 1;
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
