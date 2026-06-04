import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import API from "../services/api";
import { login as loginAPI } from "../services/authService";

const AuthContext = createContext();
const AUTH_USER_STORAGE_KEY = "user:v1";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await API.get("/auth/me.php");

        if (res.data.status === "success") {
          setUser(res.data.user);
          localStorage.setItem(
            AUTH_USER_STORAGE_KEY,
            JSON.stringify(res.data.user)
          );
          localStorage.removeItem("user");
        } else {
          setUser(null);
          localStorage.removeItem(AUTH_USER_STORAGE_KEY);
          localStorage.removeItem("user");
        }
      } catch {
        setUser(null);
        localStorage.removeItem(AUTH_USER_STORAGE_KEY);
        localStorage.removeItem("user");
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  const login = useCallback(async (credentials) => {
    const res = await loginAPI(credentials);

    if (res.status === "success") {
      setUser(res.user);
      localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(res.user));
      localStorage.removeItem("user");
    }

    return res;
  }, []);

  const logout = useCallback(async () => {
    try {
      await API.post("/auth/logout.php");
    } catch {
      // still clear frontend auth even if backend logout fails
    }

    setUser(null);
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    localStorage.removeItem("user");
  }, []);

  const contextValue = useMemo(
    () => ({
      user,
      setUser,
      loading,
      login,
      logout,
    }),
    [user, loading, login, logout]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => use(AuthContext);
