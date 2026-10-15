const User = require("../Models/User");

module.exports = async (req, res, next) => {
  try {
    if (req.user.role === "super_admin") return next();
    if (req.user.role !== "student") return res.status(403).json({ message: "Access Denied" });
    const user = await User.findById(req.user.id).select("studentId");
    return user?.studentId === req.params.studentId
      ? next() : res.status(403).json({ message: "Access Denied" });
  } catch (error) { return res.status(500).json({ message: error.message }); }
};
