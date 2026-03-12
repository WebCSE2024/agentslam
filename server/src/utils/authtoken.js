import crypto from "crypto";
import jwt from "jsonwebtoken";

const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || "30m";
const REFRESH_TOKEN_TTL = process.env.REFRESH_TOKEN_TTL || "7d";

export function generateSessionId() {
  return crypto.randomBytes(16).toString("hex");
}

export function generateTokenId() {
  return crypto.randomBytes(16).toString("hex");
}

export function signAccessToken({ userId, sid, role, username, email }) {
  return jwt.sign(
    { sub: userId, sid, role, username, email, type: "access" },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  );
}

export function signRefreshToken({ userId, sid }) {
  return jwt.sign(
    { sub: userId, sid, type: "refresh" },
    process.env.JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_TTL }
  );
}

/**
 * Short-lived passkey token embedded in the WS login link.
 * Contains the same identity payload as an access token but is typed
 * "passkey" so it can never be used where an access / refresh token is expected.
 */
export function signPasskeyToken({ userId, sid, role, username, email }) {
  return jwt.sign(
    { sub: userId, sid, role, username, email, type: "passkey" },
    process.env.JWT_SECRET,
    { expiresIn: "24h" }
  );
}

export function signSandboxToken({userId}){
  return jwt.sign(
    { sub: userId, type: "sandbox" },
    process.env.JWT_SECRET,
    { expiresIn: "45d" }
  );
} 

export function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

export function getCookieOptions({ httpOnly }) {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly,
    secure: isProd,
    sameSite: "lax",
    path: "/",
  };
}
