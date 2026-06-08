require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const notificationRoutes =require("./routes/notificationRoutes");
const reportRoutes =require("./routes/reportRoutes");
const adminRoutes =require("./routes/adminRoutes");

console.log("JWT_SECRET =", process.env.JWT_SECRET);

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/payments",paymentRoutes);// app.use("/api/payments", paymentRoutes);
app.use("/api/reports",reportRoutes);

app.use("/api/notifications",notificationRoutes);
app.use("/api/admin",adminRoutes);
mongoose.connect(process.env.MONGO_URI)
.then(() => {
    console.log("MongoDB Connected");
})
.catch((err) => {
    console.log("❌ MongoDB Connection Error:");
    console.log(err.message);
});

app.get("/", (req, res) => {
    res.send("EduPay Verify API Running");
});

app.listen(process.env.PORT || 5000, () => {
    console.log("Server Running");
});