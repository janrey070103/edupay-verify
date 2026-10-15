const router = require("express").Router();
const protect = require("../middleware/protect");
const superAdminOnly = require("../middleware/superAdminOnly");
const { publish, list, mine } = require("../controllers/termScheduleController");
router.post("/", protect, superAdminOnly, publish);
router.get("/", protect, superAdminOnly, list);
router.get("/mine", protect, mine);
module.exports = router;
