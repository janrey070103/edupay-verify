import { Navigate } from "react-router-dom";
import { getDefaultRoute } from "../hooks/useAuth";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to={getDefaultRoute(role)} replace />;
  }

  return children;
};

export default ProtectedRoute;
