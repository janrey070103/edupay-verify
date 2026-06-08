const PageHeader = ({ title, subtitle, action }) => (
  <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h1 className="text-3xl font-black tracking-tight text-gray-800">{title}</h1>
      {subtitle && (
        <p className="mt-1 text-sm font-medium text-gray-500">{subtitle}</p>
      )}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

export default PageHeader;
