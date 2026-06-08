/**
 * Seed script — creates the first super_admin account.
 *
 * Usage:
 *   node server/seedSuperAdmin.js
 *
 * Environment:
 *   Requires the same .env (or MONGO_URI) used by the server.
 *   Defaults to mongodb://localhost:27017/edupay-verify
 */

require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./Models/User");

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/edupay-verify";

const SUPER_ADMIN = {
  studentId: "SA-001",
  name: "Super Admin",
  email: "superadmin@sti.edu",
  password: "Admin@123", // change after first login
  role: "super_admin",
  isActive: true,
};

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    const existing = await User.findOne({ role: "super_admin" });
    if (existing) {
      console.log(
        `Super admin already exists: ${existing.email} (id: ${existing._id})`
      );
      process.exit(0);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(SUPER_ADMIN.password, salt);

    const user = await User.create({
      ...SUPER_ADMIN,
      password: hashedPassword,
    });

    console.log("Super admin created successfully:");
    console.log(`  Email:    ${user.email}`);
    console.log(`  Password: ${SUPER_ADMIN.password}`);
    console.log(`  ID:       ${user._id}`);
    console.log("\nPlease change the password after first login.");
    process.exit(0);
  } catch (err) {
    console.error("Seed failed:", err.message);
    process.exit(1);
  }
}

seed();
