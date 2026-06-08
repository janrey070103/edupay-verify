const getStoredUser = () => {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const useAuth = () => {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  const user = getStoredUser();

  const displayName = user?.name ?? "User";
  const initials = displayName.charAt(0).toUpperCase();

  return { token, role, user, displayName, initials };
};

export const clearAuth = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  localStorage.removeItem("user");
};

export const getDefaultRoute = (role) => {
  if (role === "student") return "/student";
  if (role === "super_admin") return "/super-admin";
  return "/cashier";
};
