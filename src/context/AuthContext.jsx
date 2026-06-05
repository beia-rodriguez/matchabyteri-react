import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import API from "../services/api";
import { login as loginAPI } from "../services/authService";

const AuthContext = createContext();
const AUTH_USER_STORAGE_KEY = "user:v1";

function readStoredUser() {
  try {
    const rawUser = localStorage.getItem(AUTH_USER_STORAGE_KEY);

    if (!rawUser) {
      return null;
    }

    return JSON.parse(rawUser);
  } catch {
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    localStorage.removeItem("user");
    return null;
  }
}

const initialUser = readStoredUser();

let authSnapshot = {
  user: initialUser,
  status: initialUser ? "ready" : "checking",
};

const authListeners = new Set();
let sessionCheckStarted = false;

function emitAuthChange() {
  authListeners.forEach((listener) => listener());
}

function setAuthSnapshot(nextSnapshot) {
  authSnapshot = {
    ...authSnapshot,
    ...nextSnapshot,
  };

  emitAuthChange();
}

function subscribeAuth(listener) {
  authListeners.add(listener);

  return () => {
    authListeners.delete(listener);
  };
}

function getAuthSnapshot() {
  return authSnapshot;
}

function getServerAuthSnapshot() {
  return {
    user: null,
    status: "checking",
  };
}

function storeUser(nextUser) {
  if (nextUser) {
    localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(nextUser));
    localStorage.removeItem("user");
  } else {
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    localStorage.removeItem("user");
  }

  setAuthSnapshot({
    user: nextUser,
    status: "ready",
  });
}

async function checkSessionOnce() {
  if (sessionCheckStarted) {
    return;
  }

  sessionCheckStarted = true;

  try {
    const res = await API.get("/auth/me.php");

    if (res.data.status === "success") {
      storeUser(res.data.user);
    } else {
      storeUser(null);
    }
  } catch {
    storeUser(null);
  }
}

export const AuthProvider = ({ children }) => {
  const authState = useSyncExternalStore(
    subscribeAuth,
    getAuthSnapshot,
    getServerAuthSnapshot
  );

  useEffect(() => {
    checkSessionOnce();
  }, []);

  const login = useCallback(async (credentials) => {
    const res = await loginAPI(credentials);

    if (res.status === "success") {
      storeUser(res.user);
    }

    return res;
  }, []);

  const logout = useCallback(async () => {
    try {
      await API.post("/auth/logout.php");
    } catch {
      // still clear frontend auth even if backend logout fails
    }

    storeUser(null);
  }, []);

  const setUser = useCallback((nextUser) => {
    storeUser(nextUser);
  }, []);

  const contextValue = useMemo(
    () => ({
      user: authState.user,
      setUser,
      loading: authState.status === "checking",
      login,
      logout,
    }),
    [authState.user, authState.status, setUser, login, logout]
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => use(AuthContext);