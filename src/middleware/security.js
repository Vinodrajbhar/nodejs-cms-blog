import crypto from 'crypto';

// ─── CSRF Protection ────────────────────────────────────────────────────────

// Generate a random CSRF token and store in session
function generateToken(session) {
  const token = crypto.randomBytes(32).toString('hex');
  session.csrfToken = token;
  return token;
}

// Middleware: attach CSRF token to res.locals and validate POST/PUT/DELETE
export const csrfProtection = (req, res, next) => {
  // Ensure a token exists in the session
  if (!req.session.csrfToken) {
    generateToken(req.session);
  }

  // Expose the token to all views
  res.locals.csrfToken = req.session.csrfToken;

  // Only validate mutating methods
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    // Skip CSRF validation for JSON API requests from the frontend
    // (they use session cookies for auth and fetch/XHR)
    if (req.path.startsWith('/admin/api/') && req.xhr) {
      return next();
    }

    const token =
      req.body._csrf ||
      req.headers['x-csrf-token'] ||
      req.headers['xsrf-token'] ||
      req.headers['x-xsrf-token'];

    if (!token || token !== req.session.csrfToken) {
      console.warn('CSRF validation failed:', {
        ip: req.ip,
        path: req.path,
        method: req.method,
      });
      return res.status(403).render('admin/error', {
        title: 'Forbidden',
        message: 'Invalid or missing CSRF token. Please refresh and try again.',
      });
    }

    // Refresh the token after each successful POST to prevent reuse
    generateToken(req.session);
  }

  next();
};

// ─── Rate Limiting (in-memory) ──────────────────────────────────────────────

const rateLimitStore = new Map();

// Clean up old entries every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore) {
      if (now - entry.resetAt > 0) {
        rateLimitStore.delete(key);
      }
    }
  },
  5 * 60 * 1000
);

/**
 * Simple in-memory rate limiter.
 * @param {number} windowMs - Time window in milliseconds (default: 15 min)
 * @param {number} max - Max requests in the window (default: 100)
 */
export const rateLimiter = (windowMs = 15 * 60 * 1000, max = 100) => {
  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();

    let entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      rateLimitStore.set(key, entry);
    }

    entry.count++;

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - entry.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

    if (entry.count > max) {
      return res.status(429).render('admin/error', {
        title: 'Too Many Requests',
        message: 'You have made too many requests. Please try again later.',
      });
    }

    next();
  };
};

// Stricter rate limiter for login/sensitive endpoints
export const strictRateLimiter = rateLimiter(15 * 60 * 1000, 10);
