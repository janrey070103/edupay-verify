// Official departments and the courses seeded into the `courses` collection on
// first start. Admins can later add or retire courses in their own department;
// seeding never overwrites those edits. Codes marked "proposed" were not in the
// school's list and should be confirmed.
const DEPARTMENTS = [
  { code: "ICT", name: "Information & Communications Technology" },
  { code: "ENG", name: "Engineering" },
  { code: "BMA", name: "Business, Management & Accountancy" },
  { code: "HTM", name: "Hospitality & Tourism Management" },
  { code: "EAS", name: "Education, Arts & Sciences" },
  { code: "CJE", name: "Criminal Justice Education" },
];

const COURSES = [
  { code: "BSIT", name: "BS in Information Technology", department: "ICT" },
  { code: "BSCS", name: "BS in Computer Science", department: "ICT" },
  { code: "BSCE", name: "BS in Civil Engineering", department: "ENG" }, // proposed code
  { code: "BSEE", name: "BS in Electrical Engineering", department: "ENG" }, // proposed code
  { code: "BSME", name: "BS in Mechanical Engineering", department: "ENG" }, // proposed code
  { code: "BSA", name: "BS in Accountancy", department: "BMA" },
  { code: "BSMA", name: "BS in Management Accounting", department: "BMA" },
  { code: "BSBA", name: "BS in Business Administration", department: "BMA" },
  { code: "BSHM", name: "BS in Hospitality Management", department: "HTM" },
  { code: "BSTM", name: "BS in Tourism Management", department: "HTM" },
  { code: "BEEd", name: "Bachelor of Elementary Education", department: "EAS" },
  { code: "BSEd", name: "Bachelor of Secondary Education", department: "EAS" },
  { code: "BECEd", name: "Bachelor of Early Childhood Education", department: "EAS" },
  { code: "BPEd", name: "Bachelor of Physical Education", department: "EAS" },
  { code: "BSPSYCH", name: "BS in Psychology", department: "EAS" },
  { code: "BACOMM", name: "BA in Communication", department: "EAS" },
  { code: "ABEL", name: "BA in English Language", department: "EAS" }, // proposed code
  { code: "BSMATH", name: "BS in Mathematics", department: "EAS" }, // proposed code
  { code: "BSCRIM", name: "BS in Criminology", department: "CJE" },
];

const DEPARTMENT_CODES = DEPARTMENTS.map((department) => department.code);

module.exports = { DEPARTMENTS, COURSES, DEPARTMENT_CODES };
