const router = require('express').Router();
const { getProfile, updateProfile, changePassword, getAllUsers, deactivateUser } = require('../controllers/user.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');

// All user routes require authentication
router.use(protect);

// User routes
router.get('/me',              getProfile);
router.patch('/me',            updateProfile);
router.patch('/me/password',   changePassword);

// Admin-only routes
router.get('/',                restrictTo('admin'), getAllUsers);
router.patch('/:id/deactivate',restrictTo('admin'), deactivateUser);

module.exports = router;
