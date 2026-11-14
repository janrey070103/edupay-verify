// Strict rule: an Admin / Super Admin "New Student Registration" notice only
// stays while the student is still pending. Once the student is verified or
// rejected it becomes "User is verified" / "User is rejected".
//
// It is applied right after a verification and again whenever an Admin or the
// Super Admin loads notifications, so students verified earlier (or by a
// device running older code) are corrected too.
const Notification = require("../Models/Notification");
const User = require("../Models/User");
const { describe } = require("../utils/notificationMeta");

const REGISTRATION = "New Student Registration";
const STAFF_ROLES = ["admin", "super_admin"];

const actorText = (actor) => (actor?.name ? ` by ${actor.name}${actor.role === "super_admin" ? " (Super Admin)" : ""}` : "");

/** Rewrites the registration notices of one student who is no longer pending. */
const settleRegistrationNotices = async (user, status, actor) => {
  const title = status === "verified" ? "User is verified" : "User is rejected";
  // No double period when the approver's name ends in "Jr." / "Sr.".
  const sentence = `${user.studentId} - ${user.name} (${user.course}) was ${status}${actorText(actor)}`;
  const message = `${sentence}${sentence.endsWith(".") ? "" : "."} No action needed.`;
  await Promise.all(STAFF_ROLES.map((role) => Notification.updateMany(
    { title: REGISTRATION, studentId: user.studentId, recipientRole: role },
    { $set: { title, message, ...describe(title, role) } },
  )));
};

/** Settles every registration notice whose student is already verified or rejected. */
const reconcileRegistrationNotices = async () => {
  const studentIds = await Notification.distinct("studentId", { title: REGISTRATION, recipientRole: { $in: STAFF_ROLES } });
  if (!studentIds.length) return 0;
  const settled = await User.find({ role: "student", studentId: { $in: studentIds.filter(Boolean) },
    verificationStatus: { $in: ["verified", "rejected"] } })
    .select("studentId name course verificationStatus verifiedBy").lean();
  if (!settled.length) return 0;
  const actors = new Map((await User.find({ _id: { $in: settled.map((s) => s.verifiedBy).filter(Boolean) } })
    .select("name role").lean()).map((actor) => [String(actor._id), actor]));
  await Promise.all(settled.map((student) =>
    settleRegistrationNotices(student, student.verificationStatus, actors.get(String(student.verifiedBy)))));
  return settled.length;
};

module.exports = { settleRegistrationNotices, reconcileRegistrationNotices, REGISTRATION };
