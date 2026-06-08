const express =
require("express");

const {
    getNotifications,
} = require(
    "../controllers/notificationController"
);

const router =
express.Router();

router.get(
    "/:studentId",
    getNotifications
);

module.exports =
router;