require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const reportRoutes = require("./routes/reportRoutes");
const verificationRoutes = require("./routes/verificationRoutes");
const qrRoutes = require("./routes/qrRoutes");
const eligibilityRoutes = require("./routes/eligibilityRoutes");
const adminRoutes = require("./routes/adminRoutes");
const userManagementRoutes = require("./routes/userManagementRoutes");
const examRoutes = require("./routes/examRoutes");
const termScheduleRoutes = require("./routes/termScheduleRoutes");
const catalogRoutes = require("./routes/catalogRoutes");
const { ensureCourseCatalog } = require("./services/catalogService");
const { startReminderJobs } = require("./services/reminderService");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/verify", verificationRoutes);
app.use("/api/qr", qrRoutes);
app.use("/api/eligibility", eligibilityRoutes);
app.use("/api/users", userManagementRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/term-schedules", termScheduleRoutes);
app.use("/api/catalog", catalogRoutes);

app.get("/", (req, res) => {
  res.send("EduPay Verify API Running");
});

app.use((error, _req, res, _next) => {
  if (error.code === "LIMIT_FILE_SIZE") return res.status(413).json({ message: "Receipt must be 10 MB or smaller." });
  if (error.message?.includes("Only JPG")) return res.status(400).json({ message: error.message });
  return res.status(500).json({ message: "Request could not be processed." });
});

const startServer = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing from server/.env");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB Connected");

    // Adds any missing official courses; never overwrites Admin edits.
    try { await ensureCourseCatalog(); } catch (error) { console.log(`Course catalogue seed skipped: ${error.message}`); }

    // Term schedules moved from one-per-school to one-per-department; replace the
    // old unique index so a second department can publish the same term.
    try { await require("./Models/TermSchedule").syncIndexes(); } catch (error) { console.log(`Term schedule index sync skipped: ${error.message}`); }

    const port = process.env.PORT || 5000;
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });

    // Hourly reminders (exam not cleared, unassigned proctors, waiting students)
    // and daily clean-up of read notifications older than ~6 months.
    startReminderJobs();
  } catch (err) {
    console.log("MongoDB Connection Error:");
    console.log(err.message);
    process.exit(1);
  }
};

startServer();
