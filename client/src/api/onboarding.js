import axiosInstance from "./axiosInstance";

/**
 * POST /api/onboarding/user
 * Create a single user and send credentials via email.
 */
export const onboardUser = (payload) =>
  axiosInstance.post("/onboarding/user", payload);

/**
 * POST /api/onboarding/users/batch
 * Bulk-create users from an array.
 * @param {Array} users  - array of { role, name, email, admissionNumber }
 */
export const onboardUsersBatch = (users) =>
  axiosInstance.post("/onboarding/users/batch", { users });
