import axios from "axios";

const adminApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/backend/api",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

export default adminApi;