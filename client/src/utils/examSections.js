// Helpers for the exam sections editor. Every exam has at least one section;
// each section is named from the course and year plus one letter (BSIT-1A) and
// has its own room and proctor.
let nextKey = 0;
export const newSectionKey = () => { nextKey += 1; return `section-${nextKey}`; };

export const emptySection = () => ({ key: newSectionKey(), letter: "", room: "", proctorId: "" });

/** "BSIT-1" from the course and year, or "" until both are chosen. */
export const sectionPrefix = (course, courseYear) => (course && courseYear ? `${course}-${courseYear}` : "");

/** Keeps one letter, in capitals. */
export const sectionLetterInput = (value) => String(value || "").replace(/[^a-z]/gi, "").slice(-1).toUpperCase();

/** Sections from a saved exam, in the editor's shape (at least one row). */
export const sectionsFromExam = (exam) => {
  const rows = (exam?.sections || []).map((section) => ({
    key: newSectionKey(), _id: section._id, letter: sectionLetterInput(String(section.name || "").slice(-1)),
    room: section.room || "", proctorId: section.proctorId?._id || section.proctorId || "",
  }));
  return rows.length ? rows : [emptySection()];
};

/** What is sent to the server (it builds the names, e.g. BSIT-1A). */
export const sectionsPayload = (sections) => sections.map(({ _id, letter, room, proctorId }) => ({
  ...(_id ? { _id } : {}), letter, room: room.trim(), proctorId: proctorId || null,
}));

/** Problem to show before saving, or "". */
export const sectionsProblem = (sections, { course, courseYear }) => {
  const prefix = sectionPrefix(course, courseYear);
  if (!prefix) return "Choose the course and course year first; the section names are built from them.";
  if (!sections.length) return "Add at least one section with its proctor.";
  const missingLetter = sections.findIndex((section) => !/^[A-Z]$/.test(section.letter));
  if (missingLetter !== -1) return `Type the letter for section ${missingLetter + 1} (for example A for ${prefix}A).`;
  const letters = sections.map((section) => section.letter);
  const repeated = letters.find((letter, index) => letters.indexOf(letter) !== index);
  if (repeated) return `Section ${prefix}${repeated} is listed twice.`;
  const noRoom = sections.find((section) => !section.room.trim());
  if (noRoom) return `Enter the room for section ${prefix}${noRoom.letter}.`;
  const noProctor = sections.find((section) => !section.proctorId);
  if (noProctor) return `Choose the proctor for section ${prefix}${noProctor.letter}.`;
  const proctors = sections.map((section) => section.proctorId);
  if (new Set(proctors).size !== proctors.length) return "A teacher can proctor only one section at a time. Choose a different proctor for each section.";
  return "";
};
