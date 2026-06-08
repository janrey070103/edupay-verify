const Notification =
require("../Models/Notification");

const getNotifications =
async (req, res) => {

    try {

        const notifications =
        await Notification.find({
            studentId:
            req.params.studentId,
            recipientRole: "student",
        }).sort({ createdAt: -1 });

        res.json(
            notifications
        );

    } catch (error) {

        res.status(500).json({
            message:
            error.message,
        });

    }
};

const getCashierNotifications =
async (req, res) => {
    try {
        const notifications =
        await Notification.find({
            recipientRole: "cashier",
        }).sort({ createdAt: -1 });

        res.json(notifications);
    } catch (error) {
        res.status(500).json({
            message: error.message,
        });
    }
};

const markAllRead =
async (req, res) => {
    try {
        await Notification.updateMany(
            { studentId: req.params.studentId, recipientRole: "student", read: false },
            { read: true }
        );
        res.json({ message: "All marked as read" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const cashierMarkAllRead =
async (req, res) => {
    try {
        await Notification.updateMany(
            { recipientRole: "cashier", read: false },
            { read: true }
        );
        res.json({ message: "All marked as read" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getNotifications,
    getCashierNotifications,
    markAllRead,
    cashierMarkAllRead,
};