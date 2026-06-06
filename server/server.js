require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const authRoutes = require("./routes/authRoutes");

console.log("JWT_SECRET =", process.env.JWT_SECRET);

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);

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