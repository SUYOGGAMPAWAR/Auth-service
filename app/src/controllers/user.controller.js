const User = require('../models/user.model');

// ── Get my profile ────────────────────────────────────────────
const getProfile = async (req, res, next) => {
  try {
    res.json({ success: true, data: req.user });
  } catch (err) { next(err); }
};

// ── Update my profile ─────────────────────────────────────────
const updateProfile = async (req, res, next) => {
  try {
    const allowed = ['name'];   // Only these fields can be self-updated
    const updates = {};
    allowed.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update.' });
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true, runValidators: true
    });

    res.json({ success: true, message: 'Profile updated.', data: user });
  } catch (err) { next(err); }
};

// ── Change password ───────────────────────────────────────────
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
    }

    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }

    user.password = newPassword;
    user.refreshTokens = [];   // Invalidate all sessions on password change
    await user.save();

    res.json({ success: true, message: 'Password changed. Please login again.' });
  } catch (err) { next(err); }
};

// ── ADMIN: Get all users ──────────────────────────────────────
const getAllUsers = async (req, res, next) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip  = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find().skip(skip).limit(limit).sort({ createdAt: -1 }),
      User.countDocuments()
    ]);

    res.json({
      success: true,
      count: users.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: users
    });
  } catch (err) { next(err); }
};

// ── ADMIN: Deactivate user ────────────────────────────────────
const deactivateUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    user.isActive = false;
    user.refreshTokens = [];
    await user.save();

    res.json({ success: true, message: 'User deactivated.' });
  } catch (err) { next(err); }
};

module.exports = { getProfile, updateProfile, changePassword, getAllUsers, deactivateUser };
