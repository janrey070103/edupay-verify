const Skeleton = ({
  className = "",
  variant = "text",
  count = 1,
}) => {
  const base = "animate-pulse rounded bg-gray-200";

  if (variant === "circle") {
    return (
      <div
        className={`${base} shrink-0 rounded-full ${className}`}
        aria-hidden="true"
      />
    );
  }

  if (variant === "table-row") {
    return Array.from({ length: count }).map((_, i) => (
      <tr key={i} className="border-b border-gray-50">
        <td className="px-6 py-4">
          <div className={`${base} h-4 w-28`} />
        </td>
        <td className="px-6 py-4">
          <div className={`${base} h-4 w-20`} />
        </td>
        <td className="px-6 py-4">
          <div className={`${base} h-4 w-16`} />
        </td>
        <td className="px-6 py-4">
          <div className={`${base} h-4 w-24`} />
        </td>
        <td className="px-6 py-4">
          <div className={`${base} h-4 w-20`} />
        </td>
        <td className="px-6 py-4">
          <div className={`${base} h-5 w-16 rounded-md`} />
        </td>
      </tr>
    ));
  }

  return Array.from({ length: count }).map((_, i) => (
    <div
      key={i}
      className={`${base} ${className}`}
      aria-hidden="true"
    />
  ));
};

export default Skeleton;
