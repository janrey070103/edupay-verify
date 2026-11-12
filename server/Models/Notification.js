const mongoose = require("mongoose");
const { describe, CATEGORIES } = require("../utils/notificationMeta");

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
    recipientUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },

    recipientRole: {
        type: String,
        enum: ["student", "cashier", "teacher", "admin", "super_admin"],
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

    // Personal notifications (one recipient) use `read`.
    read: {
        type: Boolean,
        default: false,
    },

    // Shared role-wide notifications (all cashiers, the Super Admin) record who
    // has read them, so one cashier marking read does not hide it from others.
    readBy: { type: [mongoose.Schema.Types.ObjectId], default: undefined },

    // Notifications tab and the page the notification opens.
    category: { type: String, enum: CATEGORIES },
    link: { type: String },

    // Reminders carry a key so the same reminder is never sent twice.
    dedupeKey: { type: String },
},
{
    timestamps: true,
}
);

notificationSchema.pre("validate", function fillMeta() {
    const meta = describe(this.title, this.recipientRole);
    if (!this.category) this.category = meta.category;
    if (!this.link) this.link = meta.link;
});

// Cursor-paged feeds per recipient.
notificationSchema.index({ _id: -1 });
notificationSchema.index({ recipientRole: 1, studentId: 1, _id: -1 });
notificationSchema.index({ recipientRole: 1, recipientUserId: 1, _id: -1 });
notificationSchema.index({ dedupeKey: 1 }, { unique: true, sparse: true, name: "uniq_reminder_key" });
// Clean-up of old notifications.
notificationSchema.index({ createdAt: 1 });

module.exports =
mongoose.model(
    "Notification",
    notificationSchema
);
