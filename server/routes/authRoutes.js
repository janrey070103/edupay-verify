const express = require("express");

const {
  register,
  login,
} = require("../controllers/authController");

const router = express.Router();

router.get("/test", (req, res) => {
  res.send("Auth Routes Working");
});

router.post("/register", register);
router.post("/login", login);

router.get("/create-user", async (req, res) => {
  const User = require("../Models/User");

  const user = await User.create({
    studentId: "2022-0001",
    name: "James",
    email: "james@gmail.com",
    password: "123456",
    role: "student",
  });

  res.json(user);
});

module.exports = router;
