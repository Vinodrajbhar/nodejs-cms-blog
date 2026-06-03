import express from 'express';
import upload, { validateFileContent } from '../middleware/upload.js';
import Media from '../models/Media.js';
import {
  getDashboard,
  getPosts,
  getCreatePost,
  createPost,
  getEditPost,
  updatePost,
  deletePost,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getTags,
  createTag,
  updateTag,
  deleteTag,
  getPages,
  getCreatePage,
  createPage,
  getEditPage,
  updatePage,
  deletePage,
  getComments,
  approveComment,
  spamComment,
  deleteComment,
  getMedia,
  uploadMedia,
  deleteMedia,
  getSettings,
  updateSettings,
  getNavigation,
  updateNavigation,
  getAuditLogs,
  getUsers,
  createUser,
  updateUserRole,
  deleteUser,
} from '../controllers/adminController.js';
import {
  getThemes,
  getCreateTheme,
  createTheme,
  getEditTheme,
  updateTheme,
  activateTheme,
  deleteTheme,
  getCustomizeTheme,
  updateCustomizeTheme,
} from '../controllers/themeController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Dashboard
router.get('/', requireAuth, getDashboard);

// Posts
router.get('/posts', requireAuth, getPosts);
router.get('/posts/new', requireAuth, getCreatePost);
router.post('/posts', requireAuth, createPost);
router.get('/posts/:id/edit', requireAuth, getEditPost);
router.post('/posts/:id/edit', requireAuth, updatePost);
router.post('/posts/:id/delete', requireAuth, deletePost);

// Categories
router.get('/categories', requireAuth, getCategories);
router.post('/categories', requireAuth, createCategory);
router.post('/categories/:id/edit', requireAuth, updateCategory);
router.post('/categories/:id/delete', requireAuth, deleteCategory);

// Tags
router.get('/tags', requireAuth, getTags);
router.post('/tags', requireAuth, createTag);
router.post('/tags/:id/edit', requireAuth, updateTag);
router.post('/tags/:id/delete', requireAuth, deleteTag);

// Pages
router.get('/pages', requireAuth, getPages);
router.get('/pages/new', requireAuth, getCreatePage);
router.post('/pages', requireAuth, createPage);
router.get('/pages/:id/edit', requireAuth, getEditPage);
router.post('/pages/:id/edit', requireAuth, updatePage);
router.post('/pages/:id/delete', requireAuth, deletePage);

// Comments
router.get('/comments', requireAuth, getComments);
router.post('/comments/:id/approve', requireAuth, approveComment);
router.post('/comments/:id/spam', requireAuth, spamComment);
router.post('/comments/:id/delete', requireAuth, deleteComment);

// Media
router.get('/media', requireAuth, getMedia);
router.get('/api/media', requireAuth, async (req, res) => {
  try {
    const items = await Media.find({}).sort({ createdAt: -1 }).lean();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch media' });
  }
});
router.post('/media/upload', requireAuth, upload.single('file'), validateFileContent, uploadMedia);
router.post('/media/:id/delete', requireAuth, deleteMedia);

// Navigation
router.get('/navigation', requireAuth, requireRole('admin'), getNavigation);
router.post('/navigation', requireAuth, requireRole('admin'), updateNavigation);

// Themes
router.get('/themes', requireAuth, requireRole('admin'), getThemes);
router.get('/themes/new', requireAuth, requireRole('admin'), getCreateTheme);
router.post('/themes', requireAuth, requireRole('admin'), createTheme);
router.get('/themes/:id/edit', requireAuth, requireRole('admin'), getEditTheme);
router.post('/themes/:id/edit', requireAuth, requireRole('admin'), updateTheme);
router.post('/themes/:id/activate', requireAuth, requireRole('admin'), activateTheme);
router.post('/themes/:id/delete', requireAuth, requireRole('admin'), deleteTheme);
router.get('/themes/:id/customize', requireAuth, requireRole('admin'), getCustomizeTheme);
router.post('/themes/:id/customize', requireAuth, requireRole('admin'), updateCustomizeTheme);

// Audit Logs
router.get('/audit-logs', requireAuth, requireRole('admin'), getAuditLogs);

// Settings
router.get('/settings', requireAuth, requireRole('admin'), getSettings);
router.post('/settings', requireAuth, requireRole('admin'), updateSettings);

// Users
router.get('/users', requireAuth, requireRole('admin'), getUsers);
router.post('/users', requireAuth, requireRole('admin'), createUser);
router.post('/users/:id/role', requireAuth, requireRole('admin'), updateUserRole);
router.post('/users/:id/delete', requireAuth, requireRole('admin'), deleteUser);

export default router;
