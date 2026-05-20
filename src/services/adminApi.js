import axios from "axios";

const adminApi = axios.create({
  baseURL: "/api",
  withCredentials: true, // Set it here during creation
  headers: {
    "Content-Type": "application/json",
  },
});

export default adminApi;