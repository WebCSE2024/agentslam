import axios from "axios";

const publicBackendUrl = import.meta.env.VITE_SERVER2_URL || "http://localhost:5001";

const publicApi = axios.create({
  baseURL: `${publicBackendUrl}/api`,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
  withCredentials: false,
});

publicApi.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (!error.response) {
      return Promise.reject(new Error("Network error – please check your connection"));
    }
    if (error.code === "ECONNABORTED") {
      return Promise.reject(new Error("Request timed out – please try again"));
    }
    return Promise.reject(error);
  }
);

export const getPublicAllMatches = () => publicApi.get("/all-match");
export const getPublicMatchById = (matchId) => publicApi.get(`/match/${matchId}`);
