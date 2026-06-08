const express =
require("express");

const {
    getNotifications,
    markAllRead,
} = require(
    "../controllers/notificationController"
);

const router =
express.Router();

router.get(
    "/:studentId",
    getNotifications
);

router.patch(
    "/:studentId/read",
    markAllRead
);

module.exports =
router;