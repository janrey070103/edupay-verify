const router = require("express").Router();
const protect = require("../middleware/protect");
const allowRoles = require("../middleware/allowRoles");
const { getCatalog, createCourse, updateCourse } = require("../controllers/catalogController");

router.get("/", getCatalog);
router.post("/courses", protect, allowRoles("admin"), createCourse);
router.patch("/courses/:code", protect, allowRoles("admin"), updateCourse);

module.exports = router;
