const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');
const morgan  = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoose  = require('mongoose');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const { errorHandler } = require('./middleware/error.middleware');

const app  = express();
const PORT = process.env.PORT || 4000;
const VERSION = process.env.APP_VERSION || '1.0.0';

// ── Security middleware ───────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS || '*' }));
app.use(morgan('combined'));
app.use(express.json({ limit: '10kb' }));

// ── Global rate limiter ───────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 100,
  message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use(limiter);

// ── Strict limiter for auth routes ────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts, please try again later.' }
});

// ── Routes ───────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({
  status: 'UP', version: VERSION, timestamp: new Date().toISOString()
}));

app.get('/ready', (req, res) => {
  const dbState = mongoose.connection.readyState;
  if (dbState === 1) {
    res.json({ status: 'READY', database: 'connected' });
  } else {
    res.status(503).json({ status: 'NOT_READY', database: 'disconnected' });
  }
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);

// ── 404 handler ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ── Error handler ─────────────────────────────────────────────
app.use(errorHandler);

// ── Database connection ───────────────────────────────────────
const connectDB = async () => {
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/authdb';
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  }
};

// ── Start ─────────────────────────────────────────────────────
const server = app.listen(PORT, async () => {
  console.log(`🚀 Auth Service running on port ${PORT} | v${VERSION}`);
  if (process.env.NODE_ENV !== 'test') await connectDB();
});

module.exports = { app, server };
