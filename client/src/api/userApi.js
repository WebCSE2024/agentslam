import axiosInstance from "./axiosInstance";

/**
 * GET /api/user/filter?role=user&status=active
 * Query params: { status, role }
 */
export const getUsersByFilter = ({ role = "user", status = "active" } = {}) =>
  axiosInstance.get("/user/filter", { params: { role, status } });

/**
 * POST /api/user/reset-password
 * Body: { email }
 */
export const resetUserPassword = ({ email }) =>
  axiosInstance.post("/user/reset-password", { email });

/**
 * POST /api/user/change-status
 * Body: { input } // user id or username
 * Toggles status between active <-> disabled
 */
export const changeStatus = ({ input }) =>
  axiosInstance.post("/user/change-status", { input });
