import API from "./api";

export const login = async (data) => {
  try {
    const res = await API.post("/auth/login.php", data);

    return {
      status: res.data?.status || "error",
      message: res.data?.message || "",
      user: res.data?.user || null,
    };
  } catch (err) {
    return err.response?.data || {
      status: "error",
      message: "Server error",
      user: null,
    };
  }
};