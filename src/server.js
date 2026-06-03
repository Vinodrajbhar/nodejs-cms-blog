import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import compression from 'compression';
import mongoose from 'mongoose';

import connectDB from './config/db.js';
import sessionConfig from './config/session.js';
import { setLocals } from './middleware/auth.js';
import { csrfProtection, strictRateLimiter } from './middleware/security.js';
import Setting from './models/Setting.js';
import Theme from './models/Theme.js';
import { injectThemeData, rebuildThemeViews } from './middleware/theme.js';

import publicRoutes from './routes/index.js';
import adminRoutes from './routes/admin.js';
import authRoutes from './routes/auth.js';
import apiRoutes from './routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Environment validation ────────────────────────────────────────────────
const REQUIRED_ENV = ['MONGODB_URI'];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'fallback-secret-key') {
  console.warn(
    'WARNING: SESSION_SECRET is using a weak default. Set a strong secret in your .env file.'
  );
}

const app = express();
const PORT = process.env.PORT || 3000;
const isDev = app.get('env') === 'development';

// Connect to MongoDB
connectDB();

// View engine
app.set('view engine', 'ejs');
const defaultViewsPath = path.join(__dirname, './src/views');
app.set('views', [defaultViewsPath]);
app.set('trust proxy', 1); // Trust first proxy for rate limiting behind reverse proxy

// Rebuild theme views after DB connection is established
(async function initTheme() {
  try {
    await rebuildThemeViews(app, defaultViewsPath);
  } catch (err) {
    console.error('[Theme] Init error (DB may not be ready yet):', err.message);
  }
})();

// Compression — gzip responses
app.use(compression());

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://cdn.tailwindcss.com',
          'https://cdn.jsdelivr.net',
          'https://code.jquery.com',
        ],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://cdn.tailwindcss.com',
          'https://cdn.jsdelivr.net',
          'https://fonts.googleapis.com',
          'https://fonts.gstatic.com',
        ],
        fontSrc: [
          "'self'",
          'https://cdn.jsdelivr.net',
          'https://fonts.gstatic.com',
          'https://fonts.googleapis.com',
        ],
        imgSrc: ["'self'", 'data:', 'https:', 'http:'],
        connectSrc: ["'self'"],
        frameSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// Static files with caching
const staticOptions = {
  maxAge: isDev ? 0 : 7 * 24 * 60 * 60 * 1000, // 7 days in production
  etag: true,
  lastModified: true,
};
app.use(express.static(path.join(__dirname, './static'), staticOptions));
app.use(express.static(path.join(__dirname, './public'), staticOptions));

// Theme static assets — serve active theme's assets under /assets/theme/
app.use('/assets/theme', async (req, res, next) => {
  try {
    const active = await Theme.getActive();
    if (active && active.slug !== 'default') {
      const themeAssetsPath = path.join(__dirname, './themes', active.slug, 'assets');
      express.static(themeAssetsPath, staticOptions)(req, res, next);
    } else {
      // Fall back to default theme assets
      const defaultAssetsPath = path.join(__dirname, './themes/default/assets');
      express.static(defaultAssetsPath, staticOptions)(req, res, next);
    }
  } catch {
    next();
  }
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(sessionConfig);
app.use(setLocals);

// Theme data — inject active theme info into all views
app.use(injectThemeData);

// CSRF protection (applied after session is ready)
app.use('/admin', csrfProtection);
app.use('/admin/login', strictRateLimiter);

// ─── Health check (before public routes to avoid catch-all interception) ────
app.get('/health', async (req, res) => {
  const dbState = mongoose.connection.readyState;
  const stateMap = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  const healthy = dbState === 1;

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: stateMap[dbState] || 'unknown',
    memory: process.memoryUsage(),
    env: process.env.NODE_ENV || 'development',
  });
});

// Routes — admin/api routes BEFORE public catch-all to prevent intercepting admin paths
app.use('/admin', adminRoutes);
app.use('/admin', authRoutes);
app.use('/api', apiRoutes);
app.use('/', publicRoutes);

// Helper to get site name for error pages
async function getSiteName() {
  try {
    return await Setting.getSetting('siteName', 'My Blog');
  } catch {
    return 'My Blog';
  }
}

// 404 handler
app.use(async (req, res) => {
  const siteName = await getSiteName();
  res.status(404).render('public/error', {
    title: 'Page Not Found',
    message: 'The page you are looking for does not exist.',
    siteName,
  });
});

// Error handler
app.use(async (err, req, res, next) => {
  console.error('Server error:', err);
  const siteName = await getSiteName();
  res.status(500).render('public/error', {
    title: 'Server Error',
    message: 'Something went wrong. Please try again later.',
    siteName,
  });
});

const server = app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

// ─── Graceful shutdown ──────────────────────────────────────────────────────
function shutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  server.close(() => {
    mongoose.connection.close(false).then(() => {
      console.log('Database connection closed.');
      process.exit(0);
    });
  });
  // Force shutdown after 10s
  setTimeout(() => {
    console.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
