import { createContext, useEffect, useState } from "react";
import PropTypes from "prop-types";
import axiosInstance from "@/api/axiosInstance";

export const UserContext = createContext(null);

export function UserContextProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const verifyAuth = async () => {
    try {
      const data = await axiosInstance.get("/auth/me");
      // The interceptor unwraps response.data; server returns ApiResponse { data: user }
      setUser(data?.data ?? data);
      return true;
    } catch {
      setUser(null);
      return false;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    verifyAuth();
  }, []);

  async function login(email, password) {
    try {
      setLoading(true);
      setError(null);
      await axiosInstance.post("/auth/login", { email, password });
      await verifyAuth();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Login failed";
      setError(msg);
      setUser(null);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try {
      await axiosInstance.post("/auth/logout");
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setUser(null);
    }
  }

  return (
    <UserContext.Provider value={{ user, loading, error, login, logout }}>
      {children}
    </UserContext.Provider>
  );
}

UserContextProvider.propTypes = {
  children: PropTypes.node,
};
