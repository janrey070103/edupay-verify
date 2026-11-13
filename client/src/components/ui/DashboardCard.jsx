const DashboardCard = ({ title, description, icon: Icon, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex min-h-11 w-full flex-col items-center justify-center rounded-xl border border-gray-100 bg-white p-5 text-center shadow-[0_2px_10px_rgba(0,0,0,0.04)] transition hover:-translate-y-1 hover:shadow-lg focus:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
  >
    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition group-hover:bg-blue-100">
      <Icon className="h-7 w-7" />
    </div>
    <h3 className="mb-2 text-lg font-bold text-gray-800">{title}</h3>
    <p className="text-sm font-medium text-gray-500">{description}</p>
  </button>
);

export default DashboardCard;
