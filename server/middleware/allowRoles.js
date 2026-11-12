// Route guard for one or more roles, e.g. allowRoles("admin") or
// allowRoles("cashier", "super_admin").
const allowRoles = (...roles) => (req, res, next) =>
  (roles.includes(req.user?.role) ? next() : res.status(403).json({ message: "Access Denied" }));

module.exports = allowRoles;
