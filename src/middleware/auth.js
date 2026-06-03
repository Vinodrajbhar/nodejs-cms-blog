// Middleware: require authentication
export const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.redirect('/admin/login');
  }
  next();
};

// Middleware: require a specific role
export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.session.userId) {
      return res.redirect('/admin/login');
    }
    if (!roles.includes(req.session.userRole)) {
      return res.status(403).render('admin/error', {
        title: 'Forbidden',
        message: 'You do not have permission to access this page.',
      });
    }
    next();
  };
};

// Middleware: make user data available in all views
export const setLocals = (req, res, next) => {
  res.locals.currentUser = req.session.userId
    ? {
        id: req.session.userId,
        username: req.session.username,
        role: req.session.userRole,
      }
    : null;
  res.locals.path = req.path;
  next();
};
