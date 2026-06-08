const express =
require("express");

const {
    getNotifications,
    getCashierNotifications,
    markAllRead,
    cashierMarkAllRead,
} = require(
    "../controllers/notificationController"
);

const router =
express.Router();

// Cashier routes (must be before /:studentId to avoid conflicts)
router.get(
    "/cashier",
    getCashierNotifications
);

router.patch(
    "/cashier/read",
    cashierMarkAllRead
);

// Student routes
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