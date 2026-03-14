export const logInfo = (event, details = "") => {
  console.log(`[${new Date().toISOString()}] ${event}${details ? ` ${details}` : ""}`);
};
