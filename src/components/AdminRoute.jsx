import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AdminRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  /*
    Not logged in.
  */
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  /*
    Logged in but not admin.
  */
  if (user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return children;
}