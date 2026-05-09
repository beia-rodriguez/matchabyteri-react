import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  /*
    Prevent redirect flicker while checking session.
  */
  if (loading) {
    return null;
  }

  /*
    User not logged in.
  */
  if (!user) {
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(
          location.pathname
        )}`}
        replace
      />
    );
  }

  return children;
}