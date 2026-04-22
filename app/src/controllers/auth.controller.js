const User = require('../models/user.model');
const { generateTokenPair, verifyRefreshToken } = require('../utils/jwt.utils');

// ── Register ──────────────────────────────────────────────────
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email and password are required.'
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    const user = await User.create({ name, email, password });
    const tokens = generateTokenPair(user);

    // Store refresh token
    user.refreshTokens.push({ token: tokens.refreshToken });
    await user.save();

    res.status(201).json({
      success: true,
      message: 'Registration successful.',
      data: { user, ...tokens }
    });
  } catch (err) { next(err); }
};

// ── Login ─────────────────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    // Explicitly select password (it's excluded by default)
    const user = await User.findOne({ email }).select('+password');
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const tokens = generateTokenPair(user);

    // Store refresh token and update last login
    user.refreshTokens.push({ token: tokens.refreshToken });
    user.lastLogin = new Date();
    // Keep max 5 refresh tokens per user
    if (user.refreshTokens.length > 5) {
      user.refreshTokens = user.refreshTokens.slice(-5);
    }
    await user.save();

    res.json({
      success: true,
      message: 'Login successful.',
      data: { user, ...tokens }
    });
  } catch (err) { next(err); }
};

// ── Refresh Token ─────────────────────────────────────────────
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Refresh token is required.' });
    }

    const decoded = verifyRefreshToken(token);
    const user = await User.findById(decoded.id);

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }

    // Verify token exists in user's stored tokens
    const tokenExists = user.refreshTokens.some(t => t.token === token);
    if (!tokenExists) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token.' });
    }

    // Rotate token — remove old, issue new
    user.refreshTokens = user.refreshTokens.filter(t => t.token !== token);
    const tokens = generateTokenPair(user);
    user.refreshTokens.push({ token: tokens.refreshToken });
    await user.save();

    res.json({
      success: true,
      message: 'Tokens refreshed.',
      data: tokens
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Refresh token expired. Please login again.' });
    }
    next(err);
  }
};

// ── Logout ────────────────────────────────────────────────────
const logout = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;

    if (token) {
      // Remove this specific refresh token
      req.user.refreshTokens = req.user.refreshTokens.filter(t => t.token !== token);
      await req.user.save();
    }

    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) { next(err); }
};

// ── Logout from all devices ───────────────────────────────────
const logoutAll = async (req, res, next) => {
  try {
    req.user.refreshTokens = [];
    await req.user.save();
    res.json({ success: true, message: 'Logged out from all devices.' });
  } catch (err) { next(err); }
};

module.exports = { register, login, refreshToken, logout, logoutAll };
