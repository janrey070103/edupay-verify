const Notification =
require("../Models/Notification");

const getNotifications =
async (req, res) => {

    try {

        const notifications =
        await Notification.find({
            studentId:
            req.params.studentId,
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

const markAllRead =
async (req, res) => {
    try {
        await Notification.updateMany(
            { studentId: req.params.studentId, read: false },
            { read: true }
        );
        res.json({ message: "All marked as read" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getNotifications,
    markAllRead,
};