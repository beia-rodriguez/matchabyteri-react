import { createContext, useContext, useEffect, useState } from "react";
import { login as loginAPI } from "../services/authService";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const login = async (credentials) => {
    const res = await loginAPI(credentials);

    if (res.status === "success") {
      setUser(res.user);
      localStorage.setItem("user", JSON.stringify(res.user));
    }

    return res;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);