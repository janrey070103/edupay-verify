// Pages call this after an action that changes a sidebar count (approve a
// payment, verify a student, mark notifications read) so badges update at once
// instead of waiting for the next poll.
export const NAV_BADGES_EVENT = "edupay:nav-badges-refresh";

export const refreshNavBadges = () => {
  window.dispatchEvent(new Event(NAV_BADGES_EVENT));
};

export const formatBadge = (count) => (count > 99 ? "99+" : String(count));
