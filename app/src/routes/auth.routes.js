const router = require('express').Router();
const { register, login, refreshToken, logout, logoutAll } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');

// Public routes
router.post('/register', register);
router.post('/login',    login);
router.post('/refresh',  refreshToken);

// Protected routes (require valid access token)
router.post('/logout',     protect, logout);
router.post('/logout-all', protect, logoutAll);

module.exports = router;
