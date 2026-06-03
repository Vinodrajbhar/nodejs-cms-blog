import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';

export const getLogin = (req, res) => {
  if (req.session.userId) {
    return res.redirect('/admin');
  }
  res.render('admin/login', { title: 'Login' });
};

export const postLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.render('admin/login', {
        title: 'Login',
        error: 'Please provide both email and password.',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.render('admin/login', {
        title: 'Login',
        error: 'Invalid email or password.',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.render('admin/login', {
        title: 'Login',
        error: 'Invalid email or password.',
      });
    }

    // Regenerate session to prevent session fixation
    req.session.regenerate(async (err) => {
      if (err) {
        console.error('Session regeneration error:', err);
        return res.render('admin/login', {
          title: 'Login',
          error: 'An unexpected error occurred. Please try again.',
        });
      }

      req.session.userId = user._id;
      req.session.username = user.username;
      req.session.userRole = user.role;
      req.session.createdAt = new Date().toISOString();

      await AuditLog.log({
        action: 'login',
        entity: 'user',
        entityId: user._id,
        description: `User logged in: ${user.username}`,
        req,
        metadata: { email: user.email },
      });

      return res.redirect('/admin');
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.render('admin/login', {
      title: 'Login',
      error: 'An unexpected error occurred. Please try again.',
    });
  }
};

export const logout = (req, res) => {
  AuditLog.log({
    action: 'logout',
    entity: 'user',
    entityId: req.session.userId,
    description: `User logged out: ${req.session.username || 'unknown'}`,
    req,
  });
  req.session.destroy((err) => {
    if (err) console.error('Logout error:', err);
    res.redirect('/admin/login');
  });
};
