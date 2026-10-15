/**
 * Seed script — creates the first super_admin account.
 *
 * Usage:
 *   node server/seedSuperAdmin.js
 *
 * Environment:
 *   Requires MONGO_URI, SUPER_ADMIN_EMAIL, and SUPER_ADMIN_PASSWORD.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./Models/User");

const MONGO_URI = process.env.MONGO_URI;

const SUPER_ADMIN = {
  studentId: process.env.SUPER_ADMIN_ID || undefined,
  name: process.env.SUPER_ADMIN_NAME || "Super Admin",
  email: process.env.SUPER_ADMIN_EMAIL,
  role: "super_admin",
  isActive: true,
};

async function seed() {
  try {
    if (!process.env.MONGO_URI || !SUPER_ADMIN.email || !process.env.SUPER_ADMIN_PASSWORD) {
      throw new Error("MONGO_URI, SUPER_ADMIN_EMAIL, and SUPER_ADMIN_PASSWORD are required.");
    }
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    const existing = await User.findOne({ role: "super_admin" });
    if (existing) {
      console.log("Super admin already exists.");
      process.exit(0);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(process.env.SUPER_ADMIN_PASSWORD, salt);

    const user = await User.create({
      ...SUPER_ADMIN,
      password: hashedPassword,
    });

    console.log("Super admin created successfully:");
    console.log(`  ID:       ${user._id}`);
    process.exit(0);
  } catch (err) {
    console.error("Seed failed:", err.message);
    process.exit(1);
  }
}

seed();
