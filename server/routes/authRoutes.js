const express = require("express");

const {
  register,
  login,
} = require("../controllers/authController");

const router = express.Router();
const protect = require("../middleware/protect");
const User = require("../Models/User");
router.get("/me", protect, async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");
  return user ? res.json(user) : res.status(404).json({ message: "User not found" });
});

router.get("/test", (req, res) => {
  res.send("Auth Routes Working");
});

router.post("/register", register);
router.post("/login", login);

module.exports = router;
