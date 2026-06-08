import { NavLink, useNavigate } from "react-router-dom";
import { getNavForRole } from "../../config/navigation";
import { useAuth, clearAuth } from "../../hooks/useAuth";
import {
  IconHome,
  IconUpload,
  IconBell,
  IconTicket,
  IconCheckCircle,
  IconBarChart,
  IconLogOut,
  IconX,
} from "../icons/Icons";

const iconMap = {
  home: IconHome,
  upload: IconUpload,
  bell: IconBell,
  ticket: IconTicket,
  check: IconCheckCircle,
  chart: IconBarChart,
};

const roleLabels = {
  student: "Student",
  cashier: "Cashier",
  admin: "Admin",
  teacher: "Teacher",
};

const Sidebar = ({ open, onClose }) => {
  const navigate = useNavigate();
  const { role, displayName, initials } = useAuth();
  const navItems = getNavForRole(role);

  const handleLogout = () => {
    clearAuth();
    navigate("/");
  };

  return (
    <aside
      className={[
        "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-gray-100 bg-white",
        "shadow-[4px_0_24px_rgba(0,0,0,0.02)] transition-transform duration-300 ease-in-out",
        "md:relative md:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
      ].join(" ")}
    >
      <div className="flex h-24 shrink-0 items-center justify-between border-b border-gray-100 px-6">
        <div className="flex items-center gap-3">
          <img
            src="/sti-logo.jpg"
            alt="STI West Negros University"
            className="h-12 w-12 shrink-0 rounded-lg object-cover"
          />
          <div className="text-left">
            <p className="text-sm font-black leading-tight">
              <span className="text-sti-blue">EduPay</span>{" "}
              <span className="text-sti-gold">Verify</span>
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
              Payment System
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 md:hidden"
          aria-label="Close menu"
        >
          <IconX className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1.5 overflow-y-auto px-4 py-6">
        {navItems.map(({ label, path, icon }) => {
          const Icon = iconMap[icon];
          return (
            <NavLink
              key={path}
              to={path}
              onClick={onClose}
              className={({ isActive }) =>
                [
                  "flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-sti-blue/20",
                  isActive
                    ? "bg-blue-50 text-sti-blue"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                ].join(" ")
              }
            >
              {Icon && <Icon className="h-5 w-5 opacity-75" />}
              {label}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-gray-100 bg-gray-50/50 p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sti-blue text-sm font-bold text-white">
            {initials}
          </div>
          <div className="min-w-0 text-left">
            <p className="truncate text-sm font-semibold text-gray-800">
              {displayName}
            </p>
            <p className="text-xs font-medium capitalize text-gray-500">
              {roleLabels[role] ?? role}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-sti-blue/20"
        >
          <IconLogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
