import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getPageTitle } from "../../config/pageTitles";
import { useAuth } from "../../hooks/useAuth";
import { getNotifications } from "../../api/notificationApi";
import { useToast } from "../../context/ToastContext";
import {
  IconMenu,
  IconBell,
  IconCheckCircle2,
  IconXCircle,
  IconInfo,
  IconArrowRight,
} from "../icons/Icons";

const POLL_INTERVAL = 10000;

const timeAgo = (dateStr) => {
  if (!dateStr) return "";
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const getTypeStyle = (title) => {
  const t = (title || "").toLowerCase();
  if (t.includes("approved") || t.includes("success"))
    return {
      Icon: IconCheckCircle2,
      bg: "bg-green-100",
      text: "text-green-600",
      symbol: "✓",
    };
  if (t.includes("rejected") || t.includes("declined"))
    return {
      Icon: IconXCircle,
      bg: "bg-red-100",
      text: "text-red-600",
      symbol: "✕",
    };
  return {
    Icon: IconInfo,
    bg: "bg-blue-100",
    text: "text-sti-blue",
    symbol: "●",
  };
};

const Header = ({ onMenuClick }) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const { showToast } = useToast();
  const title = getPageTitle(pathname);

  const studentId = user?.studentId;
  const isStudent = role === "student";

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const lastPollRef = useRef(null);
  const dropdownRef = useRef(null);

  /* Fetch notifications */
  const fetchNotifications = useCallback(
    async (silent = false) => {
      if (!isStudent || !studentId) return;
      try {
        const data = await getNotifications(studentId);
        const unread = data.filter((n) => !n.read).length;

        /* Show toast for new ones if polling (not first load) */
        if (!silent && lastPollRef.current) {
          const newer = data.filter(
            (n) => new Date(n.createdAt) > lastPollRef.current
          );
          newer.forEach((n) => {
            const t = (n.title || "").toLowerCase();
            const type = t.includes("rejected")
              ? "error"
              : t.includes("approved")
                ? "success"
                : "info";
            showToast(n.message || n.title, type);
          });
        }

        if (data.length > 0) {
          lastPollRef.current = new Date(
            data[0].createdAt
          );
        }

        setNotifications(data.slice(0, 8));
        setUnreadCount(unread);
      } catch {
        /* silent fail for polling */
      }
    },
    [isStudent, studentId, showToast]
  );

  /* Initial load */
  useEffect(() => {
    fetchNotifications(true);
  }, [fetchNotifications]);

  /* Polling every 10s */
  useEffect(() => {
    if (!isStudent || !studentId) return;
    const interval = setInterval(() => {
      fetchNotifications(false);
    }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [isStudent, studentId, fetchNotifications]);

  /* Close on outside click */
  useEffect(() => {
    const handler = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () =>
      document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="flex h-20 shrink-0 items-center justify-between border-b border-gray-100 bg-white px-4 shadow-[0_2px_10px_rgba(0,0,0,0.02)] sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="min-h-11 rounded-lg p-2.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-sti-blue focus:outline-none focus:ring-2 focus:ring-sti-blue/20 md:hidden"
          aria-label="Open menu"
        >
          <IconMenu className="h-5 w-5" />
        </button>
        <h2 className="text-xl font-bold text-gray-800 sm:text-2xl">
          {title}
        </h2>
      </div>

      {/* Bell + dropdown (student only) */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => {
            if (isStudent) {
              setDropdownOpen((prev) => !prev);
            } else {
              navigate("/notifications");
            }
          }}
          className="relative min-h-11 rounded-full p-2.5 text-gray-400 transition-colors hover:bg-blue-50 hover:text-sti-blue focus:outline-none focus:ring-2 focus:ring-sti-blue/20"
          aria-label="Notifications"
        >
          <IconBell className="h-6 w-6" />

          {/* Badge */}
          {isStudent && unreadCount > 0 && (
            <span className="absolute bottom-0 right-0 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow-sm ring-2 ring-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        {/* Dropdown panel */}
        {dropdownOpen && isStudent && (
          <div className="absolute right-0 z-50 mt-2 w-96 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-sm font-bold text-gray-800">
                Notifications
              </p>
              {unreadCount > 0 && (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-sti-blue">
                  {unreadCount} unread
                </span>
              )}
            </div>

            {/* List */}
            <div className="custom-scrollbar max-h-80 overflow-y-auto divide-y divide-gray-50">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm font-semibold text-gray-500">
                    No notifications
                  </p>
                  <p className="text-xs text-gray-400">
                    You're all caught up!
                  </p>
                </div>
              ) : (
                notifications.map((item) => {
                  const { bg, text, symbol } =
                    getTypeStyle(item.title);
                  const isUnread = !item.read;

                  return (
                    <div
                      key={item._id}
                      className={[
                        "flex items-start gap-3 px-4 py-3 transition-colors",
                        isUnread
                          ? "bg-blue-50/40 hover:bg-blue-50"
                          : "hover:bg-gray-50/50",
                      ].join(" ")}
                    >
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${bg} ${text} text-xs font-bold`}
                      >
                        {symbol}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm line-clamp-2 ${isUnread ? "font-bold text-gray-900" : "font-medium text-gray-800"}`}
                        >
                          {item.message || item.title}
                        </p>
                        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                          {timeAgo(item.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 bg-gray-50/80">
              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(false);
                  navigate("/notifications");
                }}
                className="flex w-full items-center justify-center gap-1.5 px-4 py-3 text-xs font-bold text-sti-blue transition-colors hover:bg-blue-50 hover:text-sti-blue-light"
              >
                View all notifications
                <IconArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
