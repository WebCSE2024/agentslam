import axios from "axios";

// Falls back to localhost:8000 for local development
const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

const axiosInstance = axios.create({
  baseURL: `${backendUrl}/api`,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

// Global response interceptor — surface network/timeout errors clearly
axiosInstance.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (!error.response) {
      return Promise.reject(
        new Error("Network error – please check your connection")
      );
    }
    if (error.code === "ECONNABORTED") {
      return Promise.reject(new Error("Request timed out – please try again"));
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
