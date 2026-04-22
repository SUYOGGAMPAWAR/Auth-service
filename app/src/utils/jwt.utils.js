const jwt = require('jsonwebtoken');

const ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET  || 'access_secret_change_in_production';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh_secret_change_in_production';
const ACCESS_EXPIRY  = process.env.JWT_ACCESS_EXPIRY  || '15m';
const REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

// ── Generate access token (short-lived) ───────────────────────
const generateAccessToken = (payload) => {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRY });
};

// ── Generate refresh token (long-lived) ───────────────────────
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRY });
};

// ── Verify access token ───────────────────────────────────────
const verifyAccessToken = (token) => {
  return jwt.verify(token, ACCESS_SECRET);
};

// ── Verify refresh token ──────────────────────────────────────
const verifyRefreshToken = (token) => {
  return jwt.verify(token, REFRESH_SECRET);
};

// ── Generate both tokens at once ──────────────────────────────
const generateTokenPair = (user) => {
  const payload = { id: user._id, email: user.email, role: user.role };
  return {
    accessToken:  generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
    expiresIn: ACCESS_EXPIRY
  };
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateTokenPair
};
