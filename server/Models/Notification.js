const mongoose = require("mongoose");

const notificationSchema =
new mongoose.Schema(
{
    studentId: {
        type: String,
        required: false,
    },

    studentName: {
        type: String,
        required: false,
    },

    recipientRole: {
        type: String,
        enum: ["student", "cashier"],
        default: "student",
    },

    title: {
        type: String,
        required: true,
    },

    message: {
        type: String,
        required: true,
    },

    read: {
        type: Boolean,
        default: false,
    },
},
{
    timestamps: true,
}
);

module.exports =
mongoose.model(
    "Notification",
    notificationSchema
);