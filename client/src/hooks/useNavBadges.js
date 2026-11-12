import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { getMyNotifications } from "../api/notificationApi";
import { getPaymentSummary } from "../api/paymentApi";
import { getPendingStudents } from "../api/userManagementApi";
import { NAV_BADGES_EVENT } from "../utils/navBadges";

const POLL_INTERVAL = 30000;

// Each badge key in config/navigation.js maps to one count source.
const SOURCES = {
  notifications: async () => (await getMyNotifications({ limit: 1 }))?.meta?.unread ?? 0,
  pendingPayments: async () => {
    const summary = await getPaymentSummary();
    return (summary?.pending ?? 0) + (summary?.needReview ?? 0);
  },
  pendingStudents: async () => (await getPendingStudents({ limit: 1 }))?.meta?.total ?? 0,
};

const KEYS_BY_ROLE = {
  student: ["notifications"],
  teacher: ["notifications"],
  cashier: ["pendingPayments", "notifications"],
  admin: ["pendingStudents", "notifications"],
  super_admin: ["notifications"],
};

// Resolves to only the counts that loaded, so a failed request keeps the last
// known value instead of flashing the badge to zero.
const fetchCounts = async (role) => {
  const keys = KEYS_BY_ROLE[role] || [];
  const results = await Promise.allSettled(keys.map((key) => SOURCES[key]()));
  const update = {};
  results.forEach((result, index) => {
    if (result.status === "fulfilled") update[keys[index]] = Number(result.value) || 0;
  });
  return update;
};

/** Live counts for sidebar badges: polled, refreshed on navigation and on demand. */
export default function useNavBadges(role) {
  const [counts, setCounts] = useState({});
  const { pathname } = useLocation();

  useEffect(() => {
    if (!KEYS_BY_ROLE[role]) return undefined;
    let active = true;
    const load = () => fetchCounts(role).then((update) => {
      if (active) setCounts((previous) => ({ ...previous, ...update }));
    });

    load();
    const interval = setInterval(load, POLL_INTERVAL);
    window.addEventListener(NAV_BADGES_EVENT, load);
    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener(NAV_BADGES_EVENT, load);
    };
  }, [role, pathname]);

  return counts;
}
