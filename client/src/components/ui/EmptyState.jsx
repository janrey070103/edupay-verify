const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="flex flex-col items-center justify-center bg-gray-50/30 py-12">
    {Icon && <Icon className="mb-3 h-12 w-12 text-gray-300" />}
    <p className="text-sm font-semibold text-gray-500">{title}</p>
    {description && (
      <p className="mt-1 text-xs text-gray-400">{description}</p>
    )}
  </div>
);

export default EmptyState;
