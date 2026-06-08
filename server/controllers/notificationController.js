const Notification =
require("../Models/Notification");

const getNotifications =
async (req, res) => {

    try {

        const notifications =
        await Notification.find({
            studentId:
            req.params.studentId,
        });

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

module.exports = {
    getNotifications,
};