const superAdminOnly = (req, res, next) => {
  if (req.user.role !== "super_admin") {
    return res.status(403).json({ message: "Access Denied" });
  }
  next();
};

module.exports = superAdminOnly;
