const DashboardCard = ({ title, description, icon: Icon, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex min-h-11 w-full flex-col items-center justify-center rounded-xl border border-gray-100 border-t-[6px] border-t-sti-gold bg-white p-6 text-center shadow-[0_2px_10px_rgba(0,0,0,0.04)] transition hover:-translate-y-1 hover:shadow-lg focus:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-sti-blue/20"
  >
    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-sti-gold/10 text-sti-blue transition group-hover:bg-sti-gold/20">
      <Icon className="h-7 w-7" />
    </div>
    <h3 className="mb-2 text-lg font-bold text-sti-blue">{title}</h3>
    <p className="text-sm font-medium text-gray-500">{description}</p>
  </button>
);

export default DashboardCard;
