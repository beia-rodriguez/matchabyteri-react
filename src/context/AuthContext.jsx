import { createContext, useContext, useEffect, useState } from "react";
import API from "../services/api";
import { login as loginAPI } from "../services/authService";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await API.get("/auth/me.php");

        if (res.data.status === "success") {
          setUser(res.data.user);
          localStorage.setItem("user", JSON.stringify(res.data.user));
        } else {
          setUser(null);
          localStorage.removeItem("user");
        }
      } catch {
        setUser(null);
        localStorage.removeItem("user");
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  const login = async (credentials) => {
    const res = await loginAPI(credentials);

    if (res.status === "success") {
      setUser(res.user);
      localStorage.setItem("user", JSON.stringify(res.user));
    }

    return res;
  };

  const logout = async () => {
    try {
      await API.post("/auth/logout.php");
    } catch {
      // still clear frontend auth even if backend logout fails
    }

    setUser(null);
    localStorage.removeItem("user");
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);