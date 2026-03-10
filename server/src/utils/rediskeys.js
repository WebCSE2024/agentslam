export function userSessionKey(userId) {
  return `session:user:${userId}`;
}

export function refreshJtiKey(sessionId) {
  return `session:refreshJti:${sessionId}`;
}

