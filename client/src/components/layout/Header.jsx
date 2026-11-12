import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { getPageTitle } from "../../config/pageTitles";
import { useAuth } from "../../hooks/useAuth";
import { getMyNotifications } from "../../api/notificationApi";
import { displayNotificationMessage } from "../../utils/notificationMessage";
import { useToast } from "../../context/ToastContext";
import { IconMenu } from "../icons/Icons";
import { refreshNavBadges } from "../../utils/navBadges";

const POLL_INTERVAL = 10000;
const NOTIFIED_ROLES = ["student", "cashier", "teacher", "admin", "super_admin"];

const toastType = (title) => {
  const t = (title || "").toLowerCase();
  if (t.includes("rejected")) return "error";
  if (t.includes("approved")) return "success";
  return "info";
};

const Header = ({ onMenuClick }) => {
  const { pathname } = useLocation();
  const { role } = useAuth();
  const { showToast } = useToast();
  const title = getPageTitle(pathname);
  const lastSeenRef = useRef(null);

  // No bell icon: the sidebar "Notifications" badge shows the unread count.
  // New notifications still pop up as toasts while the user is on any page.
  useEffect(() => {
    if (!NOTIFIED_ROLES.includes(role)) return undefined;
    let active = true;

    const poll = async () => {
      try {
        const { data = [] } = await getMyNotifications({ limit: 8 });
        if (!active) return;
        if (lastSeenRef.current) {
          const fresh = data.filter((n) => new Date(n.createdAt) > lastSeenRef.current);
          fresh.forEach((n) => showToast(displayNotificationMessage(n.message) || n.title, toastType(n.title)));
          // Something changed (e.g. a payment was approved): let badges and live
          // panels such as the Tuition Ledger refresh now instead of on their next poll.
          if (fresh.length) refreshNavBadges();
        }
        if (data.length > 0) lastSeenRef.current = new Date(data[0].createdAt);
        else if (!lastSeenRef.current) lastSeenRef.current = new Date(0);
      } catch {
        /* polling failures are silent */
      }
    };

    poll();
    const interval = setInterval(poll, POLL_INTERVAL);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [role, showToast]);

  return (
    <header className="flex h-20 shrink-0 items-center justify-between border-b border-gray-100 bg-white px-4 shadow-[0_2px_10px_rgba(0,0,0,0.02)] sm:px-6 lg:px-8 print:hidden">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="min-h-11 rounded-lg p-2.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 md:hidden"
          aria-label="Open menu"
        >
          <IconMenu className="h-5 w-5" />
        </button>
        <h2 className="text-xl font-bold text-gray-800 sm:text-2xl">
          {title}
        </h2>
      </div>
    </header>
  );
};

export default Header;
