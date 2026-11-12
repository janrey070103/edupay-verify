const router = require("express").Router();
const protect = require("../middleware/protect");
const adminOnly = require("../middleware/allowRoles")("admin");
const { publish, list, mine } = require("../controllers/termScheduleController");
router.post("/", protect, adminOnly, publish);
router.get("/", protect, adminOnly, list);
router.get("/mine", protect, mine);
module.exports = router;
