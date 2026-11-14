const mongoose = require("mongoose");
const Notification = require("../Models/Notification");
const User = require("../Models/User");
const { describe, titlesFor, CATEGORIES } = require("../utils/notificationMeta");
const { reconcileRegistrationNotices } = require("../services/registrationNotices");

// Cashier and Super Admin notifications are shared by everyone in the role;
// each person's read status is kept in `readBy`. Everyone else has a personal
// feed where `read` is enough.
const SHARED_ROLES = ["cashier", "super_admin"];

/** { base, shared } for the caller's feed; base null = response already sent. */
const readFeed = async (req, res) => {
  const role = req.user.role;
  if (role === "student" || role === "teacher") {
    const user = await User.findById(req.user.id);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return { base: null };
    }
    return {
      shared: false,
      base: role === "teacher"
        ? { recipientRole: role, $or: [{ recipientUserId: user._id },
            ...(user.studentId ? [{ studentId: user.studentId }] : [])] }
        : { studentId: user.studentId, recipientRole: role },
    };
  }
  // Role-wide notices plus any addressed to this person (e.g. their welcome).
  if (SHARED_ROLES.includes(role)) {
    return { shared: true, base: { recipientRole: role,
      $or: [{ recipientUserId: { $in: [null] } }, { recipientUserId: userObjectId(req) }] } };
  }
  // Admins are department-scoped, so each gets only notices addressed to them.
  if (role === "admin") {
    return { shared: false, base: { recipientRole: "admin", recipientUserId: new mongoose.Types.ObjectId(req.user.id) } };
  }
  return { base: undefined };
};

const userObjectId = (req) => new mongoose.Types.ObjectId(req.user.id);

// Older shared notifications marked `read: true` count as read for everyone.
const unreadFilter = (req, shared) => (shared
  ? { read: { $ne: true }, readBy: { $ne: userObjectId(req) } }
  : { read: false });

const categoryFilter = (category) => ({ $or: [{ category },
  { category: { $exists: false }, title: { $in: titlesFor(category) } }] });

const present = (req, shared) => (item) => {
  const meta = describe(item.title, item.recipientRole);
  const { readBy, ...rest } = item;
  const uid = String(req.user.id);
  return {
    ...rest,
    category: item.category || meta.category,
    link: item.link || meta.link,
    read: shared ? item.read === true || (readBy || []).some((id) => String(id) === uid) : Boolean(item.read),
  };
};

// GET /notifications?limit&before|after&order=asc|desc&category=&unread=1
// Notifications are an append-only feed, so they use an `_id` cursor instead of
// page numbers: new ones arriving during polling never shift delivered rows.
const getMyNotifications = async (req, res) => {
  try {
    const { base, shared } = await readFeed(req, res);
    if (base === null) return undefined;
    if (base === undefined) return res.json({ data: [], meta: { limit: 20, total: 0, unread: 0, nextCursor: null } });
    // Registration notices of students who are no longer pending become
    // "User is verified" / "User is rejected" before they are shown.
    if (req.user.role === "admin" || req.user.role === "super_admin") {
      await reconcileRegistrationNotices().catch((error) =>
        console.error("Could not settle registration notifications:", error.message));
    }

    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const ascending = req.query.order === "asc";
    const view = { $and: [base] };
    if (CATEGORIES.includes(req.query.category)) view.$and.push(categoryFilter(req.query.category));
    if (req.query.unread === "1") view.$and.push(unreadFilter(req, shared));

    const page = { $and: [...view.$and] };
    const cursor = ascending ? req.query.after : req.query.before;
    if (mongoose.isValidObjectId(cursor)) page.$and.push({ _id: ascending ? { $gt: cursor } : { $lt: cursor } });

    const [items, total, unread] = await Promise.all([
      Notification.find(page).sort({ _id: ascending ? 1 : -1 }).limit(limit + 1).lean(),
      Notification.countDocuments(view),
      // Whole-feed unread count for the sidebar badge, not just this tab.
      Notification.countDocuments({ $and: [base, unreadFilter(req, shared)] }),
    ]);
    const hasMore = items.length > limit;
    const data = (hasMore ? items.slice(0, limit) : items).map(present(req, shared));
    return res.json({
      data,
      meta: { limit, total, unread, order: ascending ? "asc" : "desc",
        nextCursor: hasMore ? String(data[data.length - 1]._id) : null },
    });
  } catch (error) {
    return res.status(500).json({ message: "Could not load notifications." });
  }
};

const markRead = async (req, filter, shared) => {
  if (shared) return Notification.updateMany(filter, { $addToSet: { readBy: userObjectId(req) } });
  return Notification.updateMany(filter, { read: true });
};

// PATCH /notifications/read: mark the whole feed read (for this person only).
const markMyNotificationsRead = async (req, res) => {
  try {
    const { base, shared } = await readFeed(req, res);
    if (base === null) return undefined;
    if (base === undefined) return res.json({ message: "No notifications to mark" });
    await markRead(req, { $and: [base, unreadFilter(req, shared)] }, shared);
    return res.json({ message: "All marked as read" });
  } catch (error) {
    return res.status(500).json({ message: "Could not update notifications." });
  }
};

// PATCH /notifications/:id/read: one notification, only if it is in the caller's feed.
const markOneRead = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Notification not found" });
    const { base, shared } = await readFeed(req, res);
    if (base === null) return undefined;
    if (base === undefined) return res.status(404).json({ message: "Notification not found" });
    const filter = { $and: [base, { _id: req.params.id }] };
    if (!await Notification.exists(filter)) return res.status(404).json({ message: "Notification not found" });
    await markRead(req, filter, shared);
    return res.json({ message: "Marked as read" });
  } catch (error) {
    return res.status(500).json({ message: "Could not update the notification." });
  }
};

module.exports = { getMyNotifications, markMyNotificationsRead, markOneRead, SHARED_ROLES };
