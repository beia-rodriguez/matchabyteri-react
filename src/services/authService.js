import API from "./api";

export const login = async (data) => {
  try {
    const res = await API.post("/auth/login.php", data);
    return res.data;
  } catch (err) {
    return err.response?.data || {
      status: "error",
      message: "Server error"
    };
  }
};