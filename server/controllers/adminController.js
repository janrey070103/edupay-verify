const Exam = require("../Models/Exam");
const Ledger = require("../Models/Ledger");
const User = require("../Models/User");
const { DEPARTMENTS } = require("../config/catalog");
const { courseScope, scopeCodes } = require("../utils/adminScope");
const { escapeRegex, readPaging } = require("../utils/pagination");
const { MISSING_PROCTOR } = require("../services/examSections");

const TERM_FIELD = { Prelim: "prelim", Midterm: "midterm", PreFinal: "preFinal", Final: "final" };
const DAY = 24 * 60 * 60 * 1000;

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

// GET /api/admin/summary: department dashboard counts in one request.
const getAdminSummary = async (req, res) => {
  try {
    const department = DEPARTMENTS.find((item) => item.code === req.user.department) || null;
    const [examScope, studentScope, codes] = await Promise.all([
      courseScope(req, "course", { includeUnassigned: true }), courseScope(req), scopeCodes(req.user.department),
    ]);
    const today = startOfToday();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    const active = { status: { $ne: "Cancelled" } };
    const upcomingUnassigned = { ...active, examDate: { $gte: today }, $and: [examScope, MISSING_PROCTOR] };

    const [pendingStudents, examsThisMonth, examsNext7Days, unassignedCount,
      unassignedExams, examsWithoutCourse, eligibility] = await Promise.all([
      User.countDocuments({ role: "student", verificationStatus: "pending", $and: [studentScope] }),
      Exam.countDocuments({ ...active, examDate: { $gte: monthStart, $lte: monthEnd }, $and: [examScope] }),
      Exam.countDocuments({ ...active, examDate: { $gte: today, $lt: new Date(today.getTime() + 7 * DAY) }, $and: [examScope] }),
      Exam.countDocuments(upcomingUnassigned),
      Exam.find(upcomingUnassigned).select("subject subjectCode course examDate schedule examType")
        .sort({ examDate: 1 }).limit(5).lean(),
      Exam.countDocuments({ ...active, course: { $in: [null, ""] } }),
      Ledger.aggregate([
        { $lookup: { from: "users", localField: "studentId", foreignField: "studentId", as: "student" } },
        { $unwind: "$student" },
        { $match: { "student.role": "student", ...(await courseScope(req, "student.course")) } },
        { $group: { _id: null,
          Prelim: { $sum: { $cond: ["$prelim", 1, 0] } }, Midterm: { $sum: { $cond: ["$midterm", 1, 0] } },
          PreFinal: { $sum: { $cond: ["$preFinal", 1, 0] } }, Final: { $sum: { $cond: ["$final", 1, 0] } } } },
      ]),
    ]);

    const { _id, ...eligibleByTerm } = eligibility[0] || { Prelim: 0, Midterm: 0, PreFinal: 0, Final: 0 };
    return res.json({
      department, courses: codes.mine,
      pendingStudents, examsThisMonth, examsNext7Days,
      unassignedProctors: unassignedCount, unassignedExams, examsWithoutCourse,
      eligibleByTerm: { Prelim: 0, Midterm: 0, PreFinal: 0, Final: 0, ...eligibleByTerm },
    });
  } catch (error) {
    return res.status(500).json({ message: "Could not load the dashboard." });
  }
};

// GET /api/admin/eligibility?term=Prelim: students of the Admin's department
// who are cleared for a term. Deliberately returns no peso amounts.
const getEligibilityReport = async (req, res) => {
  try {
    const field = TERM_FIELD[req.query.term];
    if (!field) return res.status(400).json({ message: "Choose an exam term." });
    const { page, limit, skip } = readPaging(req.query, { limit: 25 });
    const studentMatch = { "student.role": "student", ...(await courseScope(req, "student.course")) };
    const search = String(req.query.search || "").trim().slice(0, 64);
    const extra = [];
    if (search) {
      const pattern = new RegExp(escapeRegex(search), "i");
      extra.push({ $or: [{ "student.studentId": pattern }, { "student.name": pattern },
        { "student.lastName": pattern }, { "student.firstName": pattern }] });
    }
    if (req.query.course) extra.push({ "student.course": String(req.query.course) });
    if (Number(req.query.yearLevel)) extra.push({ "student.yearLevel": Number(req.query.yearLevel) });

    const [result] = await Ledger.aggregate([
      { $match: { [field]: true } },
      { $lookup: { from: "users", localField: "studentId", foreignField: "studentId", as: "student" } },
      { $unwind: "$student" },
      { $match: extra.length ? { $and: [studentMatch, ...extra] } : studentMatch },
      { $facet: {
        data: [
          // Default: by surname. sort=createdAt orders by when the student was first
          // cleared (the ledger is created with the first approved payment).
          { $sort: req.query.sort === "createdAt"
            ? { _id: req.query.order === "asc" ? 1 : -1 }
            : { "student.lastName": 1, "student.firstName": 1, "student.name": 1, _id: 1 } },
          { $skip: skip }, { $limit: limit },
          { $project: { _id: 1, studentId: 1, fullyPaid: 1, clearedAt: { $toDate: "$_id" },
            name: "$student.name", firstName: "$student.firstName", middleName: "$student.middleName",
            lastName: "$student.lastName", course: "$student.course",
            yearLevel: "$student.yearLevel", isActive: "$student.isActive" } },
        ],
        total: [{ $count: "count" }],
      } },
    ]);
    const total = result?.total?.[0]?.count || 0;
    return res.json({ data: result?.data || [],
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (error) {
    return res.status(500).json({ message: "Could not load the eligibility report." });
  }
};

// GET /api/admin/verified-students: verified (enrolled) students of the Admin's
// department, with who verified them and when. `verifiedBy=me` narrows it to
// the students this Admin verified. Sorted newest verification first.
const getVerifiedStudents = async (req, res) => {
  try {
    const paging = readPaging(req.query, { limit: 25 });
    const and = [await courseScope(req)];
    const search = String(req.query.search || "").trim().slice(0, 64);
    if (search) {
      const pattern = new RegExp(escapeRegex(search), "i");
      and.push({ $or: [{ studentId: pattern }, { name: pattern }, { lastName: pattern }, { firstName: pattern }, { email: pattern }] });
    }
    if (req.query.course) and.push({ course: String(req.query.course) });
    if (Number(req.query.yearLevel)) and.push({ yearLevel: Number(req.query.yearLevel) });
    if (req.query.verifiedBy === "me") and.push({ verifiedBy: req.user.id });
    const filter = { role: "student", verificationStatus: "verified", $and: and };

    const direction = req.query.order === "asc" ? 1 : -1;
    const sort = req.query.sort === "name"
      ? { lastName: direction, firstName: direction, name: direction, _id: direction }
      : { verifiedAt: direction, createdAt: direction, _id: direction };
    const [students, total, mine] = await Promise.all([
      User.find(filter).select("studentId name firstName middleName lastName nameExtension email course yearLevel semester schoolYear isActive verifiedAt verifiedBy")
        .collation({ locale: "en", strength: 1 }).sort(sort).skip(paging.skip).limit(paging.limit).lean(),
      User.countDocuments(filter),
      User.countDocuments({ role: "student", verificationStatus: "verified", verifiedBy: req.user.id, $and: [and[0]] }),
    ]);

    const verifierIds = [...new Set(students.map((s) => s.verifiedBy && String(s.verifiedBy)).filter(Boolean))];
    const verifiers = new Map((await User.find({ _id: { $in: verifierIds } }).select("name role").lean())
      .map((user) => [String(user._id), user]));
    const data = students.map(({ verifiedBy, ...student }) => {
      const verifier = verifiedBy ? verifiers.get(String(verifiedBy)) : null;
      return { ...student,
        verifiedByName: verifier?.name || null,
        verifiedByRole: verifier?.role || null,
        verifiedByMe: Boolean(verifiedBy) && String(verifiedBy) === String(req.user.id) };
    });
    return res.json({ data, meta: { page: paging.page, limit: paging.limit, total,
      totalPages: Math.max(1, Math.ceil(total / paging.limit)), verifiedByMe: mine } });
  } catch (error) {
    return res.status(500).json({ message: "Could not load verified students." });
  }
};

module.exports = { getAdminSummary, getEligibilityReport, getVerifiedStudents };
