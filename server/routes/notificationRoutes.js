const express = require("express");
const protect = require("../middleware/protect");
const {
    getMyNotifications,
    markMyNotificationsRead,
    markOneRead,
} = require("../controllers/notificationController");

const router = express.Router();

router.use(protect);

router.get("/", getMyNotifications);
router.patch("/read", markMyNotificationsRead);
router.patch("/:id/read", markOneRead);

module.exports = router;