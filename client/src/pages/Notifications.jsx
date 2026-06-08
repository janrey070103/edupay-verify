import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../context/ToastContext";
import {
  getNotifications,
  markAllRead,
} from "../api/notificationApi";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import Skeleton from "../components/ui/Skeleton";
import {
  IconBell,
  IconCheckCircle2,
  IconXCircle,
  IconInfo,
  IconCheck,
  IconLoader,
} from "../components/icons/Icons";

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

const getNotificationIcon = (title) => {
  const t = (title || "").toLowerCase();
  if (t.includes("approved") || t.includes("success"))
    return {
      Icon: IconCheckCircle2,
      bg: "bg-green-100",
      text: "text-green-600",
    };
  if (t.includes("rejected") || t.includes("declined"))
    return {
      Icon: IconXCircle,
      bg: "bg-red-100",
      text: "text-red-600",
    };
  return {
    Icon: IconInfo,
    bg: "bg-blue-100",
    text: "text-sti-blue",
  };
};

const Notifications = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const studentId = user?.studentId;

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!studentId) return;

    const fetch = async () => {
      try {
        const data = await getNotifications(studentId);
        setNotifications(data);
        setError("");
      } catch {
        setError("Could not load notifications.");
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [studentId]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const handleMarkAllRead = async () => {
    if (!studentId) return;
    setMarking(true);
    try {
      await markAllRead(studentId);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true }))
      );
      showToast("All notifications marked as read.", "success");
    } catch {
      showToast("Failed to mark all as read.", "error");
    } finally {
      setMarking(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Your Notifications"
        subtitle="Stay updated on your payment verification status."
        action={
          unreadCount > 0 ? (
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={marking}
              className="flex min-h-11 items-center gap-2 rounded-lg bg-blue-50 px-4 py-2.5 text-sm font-bold text-sti-blue transition-colors hover:bg-sti-blue hover:text-white focus:outline-none focus:ring-2 focus:ring-sti-blue/20 disabled:opacity-60"
            >
              {marking ? (
                <IconLoader className="h-4 w-4" />
              ) : (
                <IconCheck className="h-4 w-4" />
              )}
              Mark all as read
            </button>
          ) : null
        }
      />

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
        {loading ? (
          <ul className="divide-y divide-gray-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="flex items-start gap-4 px-6 py-4">
                <Skeleton variant="circle" className="h-10 w-10" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-40 mb-2" />
                  <Skeleton className="h-3 w-64 mb-1.5" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </li>
            ))}
          </ul>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={IconBell}
            title="You're all caught up!"
            description="No notifications to display. Check back later."
          />
        ) : (
          <ul className="divide-y divide-gray-100">
            {notifications.map((item) => {
              const { Icon, bg, text } = getNotificationIcon(item.title);
              const isUnread = !item.read;

              return (
                <li
                  key={item._id}
                  className={[
                    "flex items-start gap-4 px-6 py-4 transition-colors",
                    isUnread
                      ? "bg-blue-50/50 hover:bg-blue-50"
                      : "hover:bg-gray-50/50",
                  ].join(" ")}
                >
                  {/* Type icon */}
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${bg} ${text}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p
                          className={`text-sm ${isUnread ? "font-bold text-gray-900" : "font-medium text-gray-800"}`}
                        >
                          {item.title}
                        </p>
                        <p className="mt-0.5 text-sm text-gray-500">
                          {item.message}
                        </p>
                      </div>

                      {/* Unread dot */}
                      {isUnread && (
                        <span className="relative mt-1.5 flex h-2.5 w-2.5 shrink-0">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-500" />
                        </span>
                      )}
                    </div>

                    <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                      {timeAgo(item.createdAt)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Notifications;
