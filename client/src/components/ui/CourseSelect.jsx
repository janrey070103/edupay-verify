/**
 * Course dropdown grouped by department. A stored value that is not in the
 * catalogue (older free-text courses) is shown as a disabled option so it is
 * visibly invalid and has to be replaced.
 */
const CourseSelect = ({
  idPrefix,
  courses,
  departments,
  course,
  onChange,
  disabled = false,
  className = "",
  labelClassName = "mb-1.5 block text-sm font-medium text-gray-700",
  required = true,
}) => {
  const legacy = course && !courses.some((item) => item.code === course);
  const grouped = departments
    .map((department) => ({ department, items: courses.filter((item) => item.department === department.code) }))
    .filter((group) => group.items.length);

  return (
    <div>
      <label htmlFor={`${idPrefix}-course`} className={labelClassName}>
        Course {required && <span className="text-red-500">*</span>}
      </label>
      <select
        id={`${idPrefix}-course`}
        value={course || ""}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={className}
      >
        <option value="">Select course</option>
        {legacy && <option value={course} disabled>{course} (not in course list, choose one)</option>}
        {grouped.map(({ department, items }) => (
          <optgroup key={department.code} label={department.name}>
            {items.map((item) => (
              <option key={item.code} value={item.code}>{item.code} - {item.name}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
};

export default CourseSelect;
