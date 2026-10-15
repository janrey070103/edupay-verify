const Notification = require("../Models/Notification");
const User = require("../Models/User");

const getMyNotifications = async (req, res) => {
    try {
        const role = req.user.role;
        let filter = null;

        if (role === "student" || role === "teacher") {
            const user = await User.findById(req.user.id);
            if (!user) return res.status(404).json({ message: "User not found" });
            filter = role === "teacher"
              ? { recipientRole: role, $or: [{ recipientUserId: user._id },
                  ...(user.studentId ? [{ studentId: user.studentId }] : [])] }
              : { studentId: user.studentId, recipientRole: role };
        } else if (role === "cashier" || role === "super_admin") {
            filter = { recipientRole: role };
        } else {
            return res.json([]);
        }

        const notifications = await Notification.find(filter).sort({ createdAt: -1 });
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const markMyNotificationsRead = async (req, res) => {
    try {
        const role = req.user.role;
        let filter = { read: false };

        if (role === "student" || role === "teacher") {
            const user = await User.findById(req.user.id);
            if (!user) return res.status(404).json({ message: "User not found" });
            if (role === "teacher") filter.$or = [{ recipientUserId: user._id },
              ...(user.studentId ? [{ studentId: user.studentId }] : [])];
            else filter.studentId = user.studentId;
            filter.recipientRole = role;
        } else if (role === "cashier" || role === "super_admin") {
            filter.recipientRole = role;
        } else {
            return res.json({ message: "No notifications to mark" });
        }

        await Notification.updateMany(filter, { read: true });
        res.json({ message: "All marked as read" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getMyNotifications,
    markMyNotificationsRead,
};
