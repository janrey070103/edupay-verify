import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../context/ToastContext";
import {
  getMyNotifications,
  markMyNotificationsRead,
  markNotificationRead,
} from "../api/notificationApi";
import PageHeader from "../components/ui/PageHeader";
import EmptyState from "../components/ui/EmptyState";
import Skeleton from "../components/ui/Skeleton";
import SortSelect from "../components/ui/SortSelect";
import { displayNotificationMessage } from "../utils/notificationMessage";
import {
  IconBell,
  IconCheckCircle2,
  IconXCircle,
  IconInfo,
  IconCheck,
  IconLoader,
  IconArrowRight,
} from "../components/icons/Icons";
import { refreshNavBadges } from "../utils/navBadges";

const PAGE_SIZE = 20;

const TABS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "payments", label: "Payments" },
  { key: "exams", label: "Exams" },
  { key: "accounts", label: "Accounts" },
];
const ORDERS = [
  { label: "Newest first", sort: "date", order: "desc" },
  { label: "Oldest first", sort: "date", order: "asc" },
];

const timeAgo = (dateStr) => {
  if (!dateStr) return "";
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric" });
};

const getNotificationIcon = (title) => {
  const t = (title || "").toLowerCase();
  if (t.includes("approved") || t.includes("verified") || t.includes("restored"))
    return { Icon: IconCheckCircle2, bg: "bg-green-100", text: "text-green-600" };
  if (t.includes("rejected") || t.includes("not cleared") || t.includes("without proctor") || t.includes("cancelled"))
    return { Icon: IconXCircle, bg: "bg-red-100", text: "text-red-600" };
  if (t.includes("receipt") || t.includes("new") || t.includes("waiting"))
    return { Icon: IconInfo, bg: "bg-sti-gold/10", text: "text-sti-gold" };
  return { Icon: IconInfo, bg: "bg-blue-100", text: "text-sti-blue" };
};

const tabParams = (tab) => (tab === "unread" ? { unread: "1" } : tab === "all" ? {} : { category: tab });

const Notifications = () => {
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [tab, setTab] = useState("all");
  const [order, setOrder] = useState("desc");
  const [notifications, setNotifications] = useState([]);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState("");

  const query = useCallback((cursor) => ({
    limit: PAGE_SIZE, order, ...tabParams(tab),
    ...(cursor ? { [order === "asc" ? "after" : "before"]: cursor } : {}),
  }), [order, tab]);

  // Reload from the top whenever the tab or the order changes.
  useEffect(() => {
    let active = true;
    getMyNotifications(query())
      .then(({ data, meta }) => {
        if (!active) return;
        setNotifications(data);
        setTotal(meta.total);
        setUnread(meta.unread ?? 0);
        setNextCursor(meta.nextCursor);
        setError("");
      })
      .catch(() => { if (active) setError("Could not load notifications."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query]);

  const changeView = (update) => {
    setLoading(true);
    update();
  };

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const { data, meta } = await getMyNotifications(query(nextCursor));
      setNotifications((current) => {
        const seen = new Set(current.map((item) => item._id));
        return [...current, ...data.filter((item) => !seen.has(item._id))];
      });
      setTotal(meta.total);
      setUnread(meta.unread ?? 0);
      setNextCursor(meta.nextCursor);
    } catch {
      showToast("Could not load more notifications.", "error");
    } finally {
      setLoadingMore(false);
    }
  };

  const markOne = async (item) => {
    if (item.read) return true;
    try {
      await markNotificationRead(item._id);
      setNotifications((prev) => (tab === "unread"
        ? prev.filter((n) => n._id !== item._id)
        : prev.map((n) => (n._id === item._id ? { ...n, read: true } : n))));
      setUnread((count) => Math.max(0, count - 1));
      refreshNavBadges();
      return true;
    } catch {
      showToast("Could not mark the notification as read.", "error");
      return false;
    }
  };

  // Clicking a notification marks it read and opens the related page.
  const openNotification = async (item) => {
    await markOne(item);
    if (item.link && item.link !== window.location.pathname) navigate(item.link);
  };

  const handleMarkAllRead = async () => {
    setMarking(true);
    try {
      await markMyNotificationsRead();
      setNotifications((prev) => (tab === "unread" ? [] : prev.map((n) => ({ ...n, read: true }))));
      setUnread(0);
      refreshNavBadges();
      showToast("All notifications marked as read.", "success");
    } catch {
      showToast("Failed to mark all as read.", "error");
    } finally {
      setMarking(false);
    }
  };

  return (
    <div className="w-full">
      <PageHeader
        action={
          unread > 0 ? (
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={marking}
              className="flex min-h-11 items-center gap-2 rounded-lg bg-blue-50 px-4 py-2.5 text-sm font-bold text-sti-blue transition-colors hover:bg-sti-blue hover:text-white focus:outline-none focus:ring-2 focus:ring-sti-blue/20 disabled:opacity-60"
            >
              {marking ? <IconLoader className="h-4 w-4" /> : <IconCheck className="h-4 w-4" />}
              Mark all as read ({unread})
            </button>
          ) : null
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Notification filter">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              onClick={() => tab !== item.key && changeView(() => setTab(item.key))}
              className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-bold transition ${tab === item.key
                ? "bg-sti-blue text-white shadow-[0_4px_14px_rgba(0,61,165,0.35)]"
                : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              {item.label}
              {item.key === "unread" && unread > 0 && (
                <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[11px] font-black leading-none text-white">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </button>
          ))}
        </div>
        <SortSelect options={ORDERS} sort="date" order={order}
          onChange={(_sort, next) => next !== order && changeView(() => setOrder(next))} label="Sort notifications" />
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
        {loading ? (
          <ul className="divide-y divide-gray-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="flex items-start gap-4 px-6 py-4">
                <Skeleton variant="circle" className="h-10 w-10" />
                <div className="flex-1">
                  <Skeleton className="mb-2 h-4 w-40" />
                  <Skeleton className="mb-1.5 h-3 w-64" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </li>
            ))}
          </ul>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={IconBell}
            title={tab === "unread" ? "No unread notifications" : "You're all caught up!"}
            description={tab === "all" ? "No notifications to display. Check back later." : "Nothing in this view right now."}
          />
        ) : (
          <ul className="divide-y divide-gray-100">
            {notifications.map((item) => {
              const { Icon, bg, text } = getNotificationIcon(item.title);
              const isUnread = !item.read;
              return (
                <li key={item._id} className={`flex items-start gap-2 pr-3 transition-colors ${isUnread ? "bg-blue-50/50" : ""}`}>
                  <button
                    type="button"
                    onClick={() => openNotification(item)}
                    className="flex min-w-0 flex-1 items-start gap-4 px-6 py-4 text-left hover:bg-blue-50/60 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sti-blue/20"
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${bg} ${text}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm ${isUnread ? "font-bold text-gray-900" : "font-medium text-gray-800"}`}>
                        {item.title}
                      </span>
                      <span className="mt-0.5 block text-sm text-gray-500">{displayNotificationMessage(item.message)}</span>
                      <span className="mt-1.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                        {timeAgo(item.createdAt)}
                        <span className="inline-flex items-center gap-1 normal-case tracking-normal text-sti-blue">
                          Open <IconArrowRight className="h-3 w-3" />
                        </span>
                      </span>
                    </span>
                  </button>
                  {isUnread && (
                    <button
                      type="button"
                      onClick={() => markOne(item)}
                      className="mt-3 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-sti-blue hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-sti-blue/20"
                      aria-label={`Mark "${item.title}" as read`}
                      title="Mark as read"
                    >
                      <IconCheck className="h-4 w-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {!loading && notifications.length > 0 && (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-[0_2px_10px_rgba(0,0,0,0.04)] sm:flex-row sm:justify-between">
          <p className="text-xs font-semibold text-gray-500" aria-live="polite">
            Showing {notifications.length} of {total}
          </p>
          {nextCursor && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="min-h-11 w-full rounded-lg border border-gray-200 bg-white px-4 text-sm font-bold text-sti-blue transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-sti-blue/20 disabled:opacity-60 sm:w-auto"
            >
              {loadingMore ? (
                <span className="inline-flex items-center gap-2"><IconLoader className="h-4 w-4" /> Loading…</span>
              ) : "Load more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default Notifications;
