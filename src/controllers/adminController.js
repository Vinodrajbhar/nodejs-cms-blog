import Post from '../models/Post.js';
import Page from '../models/Page.js';
import Comment from '../models/Comment.js';
import Category from '../models/Category.js';
import Tag from '../models/Tag.js';
import User from '../models/User.js';
import Media from '../models/Media.js';
import Setting from '../models/Setting.js';
import AuditLog from '../models/AuditLog.js';
import upload from '../middleware/upload.js';
import { generateSlug } from '../utils/slug.js';
import {
  storeOldPermalinkStructure,
  validatePermalinkStructure,
  PERMALINK_PRESETS,
} from '../utils/permalink.js';

export const getDashboard = async (req, res) => {
  try {
    const [postCount, pageCount, commentCount, userCount, recentPosts] = await Promise.all([
      Post.countDocuments(),
      Page.countDocuments(),
      Comment.countDocuments(),
      User.countDocuments(),
      Post.find().populate('author', 'username').sort({ createdAt: -1 }).limit(5).lean(),
    ]);

    const pendingComments = await Comment.countDocuments({ status: 'pending' });

    res.render('admin/dashboard', {
      title: 'Dashboard',
      stats: { postCount, pageCount, commentCount, userCount, pendingComments },
      recentPosts,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).render('admin/error', {
      title: 'Error',
      message: 'Failed to load dashboard.',
    });
  }
};

// ─── Post CRUD ──────────────────────────────────────────────────────────────

export const getPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 15;
    const skip = (page - 1) * limit;
    const status = req.query.status || '';
    const search = req.query.search || '';

    const filter = {};
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { excerpt: { $regex: search, $options: 'i' } },
      ];
    }

    const [posts, total] = await Promise.all([
      Post.find(filter)
        .populate('author', 'username')
        .populate('categories', 'name')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Post.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.render('admin/posts/list', {
      title: 'Posts',
      posts,
      currentPage: page,
      totalPages,
      total,
      filterStatus: status,
      searchQuery: search,
    });
  } catch (error) {
    console.error('getPosts error:', error);
    res.status(500).render('admin/error', { title: 'Error', message: 'Failed to load posts.' });
  }
};

export const getCreatePost = async (req, res) => {
  try {
    const [categories, tags] = await Promise.all([
      Category.find({}).sort({ name: 1 }).lean(),
      Tag.find({}).sort({ name: 1 }).lean(),
    ]);
    res.render('admin/posts/form', {
      title: 'New Post',
      post: null,
      categories,
      tags,
    });
  } catch (error) {
    console.error('getCreatePost error:', error);
    res.status(500).render('admin/error', { title: 'Error', message: 'Failed to load form.' });
  }
};

export const createPost = async (req, res) => {
  try {
    const {
      title,
      content,
      excerpt,
      status,
      categoryIds,
      tagIds,
      seoTitle,
      metaDescription,
      focusKeyphrase,
      ogImage,
      ogTitle,
      ogDescription,
      canonicalUrl,
      noindex,
      breadcrumbTitle,
      scheduledAt,
    } = req.body;

    if (!title) {
      const [categories, tags] = await Promise.all([
        Category.find({}).sort({ name: 1 }).lean(),
        Tag.find({}).sort({ name: 1 }).lean(),
      ]);
      return res.render('admin/posts/form', {
        title: 'New Post',
        post: null,
        categories,
        tags,
        error: 'Title is required.',
      });
    }

    let slug = generateSlug(title);

    // Ensure unique slug
    let existing = await Post.findOne({ slug });
    let counter = 1;
    while (existing) {
      slug = generateSlug(title) + '-' + counter;
      existing = await Post.findOne({ slug });
      counter++;
    }

    const post = await Post.create({
      title,
      slug,
      content: content || '',
      excerpt: excerpt || '',
      featuredImage: req.body.featuredImage || '',
      author: req.session.userId,
      categories: Array.isArray(categoryIds) ? categoryIds : categoryIds ? [categoryIds] : [],
      tags: Array.isArray(tagIds) ? tagIds : tagIds ? [tagIds] : [],
      status: status || 'draft',
      publishedAt:
        status === 'published'
          ? new Date()
          : status === 'scheduled' && scheduledAt
            ? new Date(scheduledAt)
            : null,
      scheduledAt: status === 'scheduled' && scheduledAt ? new Date(scheduledAt) : null,
      // SEO fields
      seoTitle: seoTitle || '',
      metaDescription: metaDescription || '',
      focusKeyphrase: focusKeyphrase || '',
      ogImage: ogImage || '',
      ogTitle: ogTitle || '',
      ogDescription: ogDescription || '',
      canonicalUrl: canonicalUrl || '',
      noindex: noindex === 'true',
      breadcrumbTitle: breadcrumbTitle || '',
    });

    // Update counts
    if (post.status === 'published') {
      await Promise.all([
        Category.updateMany({ _id: { $in: post.categories } }, { $inc: { postCount: 1 } }),
        Tag.updateMany({ _id: { $in: post.tags } }, { $inc: { postCount: 1 } }),
      ]);
    }

    AuditLog.log({
      action: 'create',
      entity: 'post',
      entityId: post._id,
      description: `Created post: ${post.title}`,
      req,
    });

    res.redirect('/admin/posts');
  } catch (error) {
    console.error('createPost error:', error);
    res.status(500).render('admin/error', { title: 'Error', message: 'Failed to create post.' });
  }
};

export const getEditPost = async (req, res) => {
  try {
    const [post, categories, tags] = await Promise.all([
      Post.findById(req.params.id).lean(),
      Category.find({}).sort({ name: 1 }).lean(),
      Tag.find({}).sort({ name: 1 }).lean(),
    ]);

    if (!post) {
      return res
        .status(404)
        .render('admin/error', { title: 'Not Found', message: 'Post not found.' });
    }

    res.render('admin/posts/form', {
      title: 'Edit Post',
      post,
      categories,
      tags,
    });
  } catch (error) {
    console.error('getEditPost error:', error);
    res.status(500).render('admin/error', { title: 'Error', message: 'Failed to load post.' });
  }
};

export const updatePost = async (req, res) => {
  try {
    const {
      title,
      content,
      excerpt,
      status,
      categoryIds,
      tagIds,
      featuredImage,
      seoTitle,
      metaDescription,
      focusKeyphrase,
      ogImage,
      ogTitle,
      ogDescription,
      canonicalUrl,
      noindex,
      breadcrumbTitle,
      scheduledAt,
    } = req.body;

    if (!title) {
      const post = await Post.findById(req.params.id).lean();
      const [categories, tags] = await Promise.all([
        Category.find({}).sort({ name: 1 }).lean(),
        Tag.find({}).sort({ name: 1 }).lean(),
      ]);
      return res.render('admin/posts/form', {
        title: 'Edit Post',
        post: { ...post, title, content, excerpt },
        categories,
        tags,
        error: 'Title is required.',
      });
    }

    const existingPost = await Post.findById(req.params.id);
    if (!existingPost) {
      return res
        .status(404)
        .render('admin/error', { title: 'Not Found', message: 'Post not found.' });
    }

    const wasPublished = existingPost.status === 'published';
    const willBePublished = status === 'published';

    let slug = existingPost.slug;
    if (title !== existingPost.title) {
      slug = generateSlug(title);
      let existing = await Post.findOne({ slug, _id: { $ne: req.params.id } });
      let counter = 1;
      while (existing) {
        slug = generateSlug(title) + '-' + counter;
        existing = await Post.findOne({ slug, _id: { $ne: req.params.id } });
        counter++;
      }
    }

    const oldCategories = existingPost.categories.map((c) => c.toString());
    const oldTags = existingPost.tags.map((t) => t.toString());
    const newCategories = Array.isArray(categoryIds)
      ? categoryIds
      : categoryIds
        ? [categoryIds]
        : [];
    const newTags = Array.isArray(tagIds) ? tagIds : tagIds ? [tagIds] : [];

    existingPost.title = title;
    existingPost.slug = slug;
    existingPost.content = content || '';
    existingPost.excerpt = excerpt || '';
    existingPost.featuredImage = featuredImage || '';
    existingPost.categories = newCategories;
    existingPost.tags = newTags;
    existingPost.status = status || 'draft';
    if (status === 'published' && willBePublished && !existingPost.publishedAt) {
      existingPost.publishedAt = new Date();
      existingPost.scheduledAt = null;
    } else if (status === 'scheduled' && scheduledAt) {
      existingPost.publishedAt = new Date(scheduledAt);
      existingPost.scheduledAt = new Date(scheduledAt);
    } else if (status === 'draft') {
      existingPost.publishedAt = null;
      existingPost.scheduledAt = null;
    }
    // SEO fields
    existingPost.seoTitle = seoTitle || '';
    existingPost.metaDescription = metaDescription || '';
    existingPost.focusKeyphrase = focusKeyphrase || '';
    existingPost.ogImage = ogImage || '';
    existingPost.ogTitle = ogTitle || '';
    existingPost.ogDescription = ogDescription || '';
    existingPost.canonicalUrl = canonicalUrl || '';
    existingPost.noindex = noindex === 'true';
    existingPost.breadcrumbTitle = breadcrumbTitle || '';

    await existingPost.save();

    // Update counts
    await Promise.all([
      Category.updateMany({ _id: { $in: oldCategories } }, { $inc: { postCount: -1 } }),
      Category.updateMany({ _id: { $in: newCategories } }, { $inc: { postCount: 1 } }),
      Tag.updateMany({ _id: { $in: oldTags } }, { $inc: { postCount: -1 } }),
      Tag.updateMany({ _id: { $in: newTags } }, { $inc: { postCount: 1 } }),
    ]);

    AuditLog.log({
      action: 'update',
      entity: 'post',
      entityId: existingPost._id,
      description: `Updated post: ${existingPost.title}`,
      req,
    });

    res.redirect('/admin/posts');
  } catch (error) {
    console.error('updatePost error:', error);
    res.status(500).render('admin/error', { title: 'Error', message: 'Failed to update post.' });
  }
};

export const deletePost = async (req, res) => {
  try {
    const post = await Post.findByIdAndDelete(req.params.id);
    if (post) {
      await Promise.all([
        Category.updateMany({ _id: { $in: post.categories } }, { $inc: { postCount: -1 } }),
        Tag.updateMany({ _id: { $in: post.tags } }, { $inc: { postCount: -1 } }),
        Comment.deleteMany({ post: post._id }),
      ]);
      AuditLog.log({
        action: 'delete',
        entity: 'post',
        entityId: post._id,
        description: `Deleted post: ${post.title}`,
        req,
      });
    }
    res.redirect('/admin/posts');
  } catch (error) {
    console.error('deletePost error:', error);
    res.status(500).render('admin/error', { title: 'Error', message: 'Failed to delete post.' });
  }
};

// ─── Categories CRUD ─────────────────────────────────────────────────────────

export const getCategories = async (req, res) => {
  try {
    const categories = await Category.find({}).sort({ name: 1 }).lean();
    res.render('admin/categories/list', { title: 'Categories', categories });
  } catch (error) {
    console.error('getCategories error:', error);
    res
      .status(500)
      .render('admin/error', { title: 'Error', message: 'Failed to load categories.' });
  }
};

export const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      const categories = await Category.find({}).sort({ name: 1 }).lean();
      return res.render('admin/categories/list', {
        title: 'Categories',
        categories,
        error: 'Category name is required.',
      });
    }

    const slug = generateSlug(name);
    const existing = await Category.findOne({ slug });
    if (existing) {
      const categories = await Category.find({}).sort({ name: 1 }).lean();
      return res.render('admin/categories/list', {
        title: 'Categories',
        categories,
        error: 'A category with this name already exists.',
      });
    }

    const cat = await Category.create({ name, slug, description: description || '' });
    AuditLog.log({
      action: 'create',
      entity: 'category',
      entityId: cat._id,
      description: `Created category: ${name}`,
      req,
    });
    res.redirect('/admin/categories');
  } catch (error) {
    console.error('createCategory error:', error);
    res
      .status(500)
      .render('admin/error', { title: 'Error', message: 'Failed to create category.' });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.redirect('/admin/categories');
    }

    const slug = generateSlug(name);
    const existing = await Category.findOne({ slug, _id: { $ne: req.params.id } });
    if (existing) {
      const categories = await Category.find({}).sort({ name: 1 }).lean();
      return res.render('admin/categories/list', {
        title: 'Categories',
        categories,
        error: 'A category with this name already exists.',
      });
    }

    await Category.findByIdAndUpdate(req.params.id, { name, slug, description: description || '' });
    res.redirect('/admin/categories');
  } catch (error) {
    console.error('updateCategory error:', error);
    res
      .status(500)
      .render('admin/error', { title: 'Error', message: 'Failed to update category.' });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const postCount = await Post.countDocuments({ categories: req.params.id });
    if (postCount > 0) {
      const categories = await Category.find({}).sort({ name: 1 }).lean();
      return res.render('admin/categories/list', {
        title: 'Categories',
        categories,
        error: `Cannot delete: ${postCount} post(s) are using this category. Remove the category from those posts first.`,
      });
    }
    await Category.findByIdAndDelete(req.params.id);
    res.redirect('/admin/categories');
  } catch (error) {
    console.error('deleteCategory error:', error);
    res
      .status(500)
      .render('admin/error', { title: 'Error', message: 'Failed to delete category.' });
  }
};

// ─── Tags CRUD ───────────────────────────────────────────────────────────────

export const getTags = async (req, res) => {
  try {
    const tags = await Tag.find({}).sort({ name: 1 }).lean();
    res.render('admin/tags/list', { title: 'Tags', tags });
  } catch (error) {
    console.error('getTags error:', error);
    res.status(500).render('admin/error', { title: 'Error', message: 'Failed to load tags.' });
  }
};

export const createTag = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      const tags = await Tag.find({}).sort({ name: 1 }).lean();
      return res.render('admin/tags/list', {
        title: 'Tags',
        tags,
        error: 'Tag name is required.',
      });
    }

    const slug = generateSlug(name);
    const existing = await Tag.findOne({ slug });
    if (existing) {
      const tags = await Tag.find({}).sort({ name: 1 }).lean();
      return res.render('admin/tags/list', {
        title: 'Tags',
        tags,
        error: 'A tag with this name already exists.',
      });
    }

    const tag = await Tag.create({ name, slug });
    AuditLog.log({
      action: 'create',
      entity: 'tag',
      entityId: tag._id,
      description: `Created tag: ${name}`,
      req,
    });
    res.redirect('/admin/tags');
  } catch (error) {
    console.error('createTag error:', error);
    res.status(500).render('admin/error', { title: 'Error', message: 'Failed to create tag.' });
  }
};

export const updateTag = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.redirect('/admin/tags');
    }

    const slug = generateSlug(name);
    const existing = await Tag.findOne({ slug, _id: { $ne: req.params.id } });
    if (existing) {
      const tags = await Tag.find({}).sort({ name: 1 }).lean();
      return res.render('admin/tags/list', {
        title: 'Tags',
        tags,
        error: 'A tag with this name already exists.',
      });
    }

    await Tag.findByIdAndUpdate(req.params.id, { name, slug });
    res.redirect('/admin/tags');
  } catch (error) {
    console.error('updateTag error:', error);
    res.status(500).render('admin/error', { title: 'Error', message: 'Failed to update tag.' });
  }
};

export const deleteTag = async (req, res) => {
  try {
    const postCount = await Post.countDocuments({ tags: req.params.id });
    if (postCount > 0) {
      const tags = await Tag.find({}).sort({ name: 1 }).lean();
      return res.render('admin/tags/list', {
        title: 'Tags',
        tags,
        error: `Cannot delete: ${postCount} post(s) are using this tag. Remove the tag from those posts first.`,
      });
    }
    await Tag.findByIdAndDelete(req.params.id);
    res.redirect('/admin/tags');
  } catch (error) {
    console.error('deleteTag error:', error);
    res.status(500).render('admin/error', { title: 'Error', message: 'Failed to delete tag.' });
  }
};

// ─── Pages CRUD ───────────────────────────────────────────────────────────────

export const getPages = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 15;
    const skip = (page - 1) * limit;
    const status = req.query.status || '';

    const filter = {};
    if (status) filter.status = status;

    const [pages, total] = await Promise.all([
      Page.find(filter)
        .populate('author', 'username')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Page.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.render('admin/pages/list', {
      title: 'Pages',
      pages,
      currentPage: page,
      totalPages,
      total,
      filterStatus: status,
    });
  } catch (error) {
    console.error('getPages error:', error);
    res.status(500).render('admin/error', { title: 'Error', message: 'Failed to load pages.' });
  }
};

export const getCreatePage = async (req, res) => {
  res.render('admin/pages/form', { title: 'New Page', page: null });
};

export const createPage = async (req, res) => {
  try {
    const {
      title,
      content,
      status,
      featuredImage,
      seoTitle,
      metaDescription,
      focusKeyphrase,
      ogImage,
      ogTitle,
      ogDescription,
      canonicalUrl,
      noindex,
      breadcrumbTitle,
    } = req.body;

    if (!title) {
      return res.render('admin/pages/form', {
        title: 'New Page',
        page: null,
        error: 'Title is required.',
      });
    }

    let slug = generateSlug(title);
    let existing = await Page.findOne({ slug });
    let counter = 1;
    while (existing) {
      slug = generateSlug(title) + '-' + counter;
      existing = await Page.findOne({ slug });
      counter++;
    }

    await Page.create({
      title,
      slug,
      content: content || '',
      author: req.session.userId,
      status: status || 'draft',
      featuredImage: featuredImage || '',
      seoTitle: seoTitle || '',
      metaDescription: metaDescription || '',
      focusKeyphrase: focusKeyphrase || '',
      ogImage: ogImage || '',
      ogTitle: ogTitle || '',
      ogDescription: ogDescription || '',
      canonicalUrl: canonicalUrl || '',
      noindex: noindex === 'true',
      breadcrumbTitle: breadcrumbTitle || '',
    });

    res.redirect('/admin/pages');
  } catch (error) {
    console.error('createPage error:', error);
    res.status(500).render('admin/error', { title: 'Error', message: 'Failed to create page.' });
  }
};

export const getEditPage = async (req, res) => {
  try {
    const page = await Page.findById(req.params.id).lean();
    if (!page) {
      return res
        .status(404)
        .render('admin/error', { title: 'Not Found', message: 'Page not found.' });
    }
    res.render('admin/pages/form', { title: 'Edit Page', page });
  } catch (error) {
    console.error('getEditPage error:', error);
    res.status(500).render('admin/error', { title: 'Error', message: 'Failed to load page.' });
  }
};

export const updatePage = async (req, res) => {
  try {
    const {
      title,
      content,
      status,
      featuredImage,
      seoTitle,
      metaDescription,
      focusKeyphrase,
      ogImage,
      ogTitle,
      ogDescription,
      canonicalUrl,
      noindex,
      breadcrumbTitle,
    } = req.body;

    if (!title) {
      const page = await Page.findById(req.params.id).lean();
      return res.render('admin/pages/form', {
        title: 'Edit Page',
        page: { ...page, title, content },
        error: 'Title is required.',
      });
    }

    const existingPage = await Page.findById(req.params.id);
    if (!existingPage) {
      return res
        .status(404)
        .render('admin/error', { title: 'Not Found', message: 'Page not found.' });
    }

    let slug = existingPage.slug;
    if (title !== existingPage.title) {
      slug = generateSlug(title);
      let existing = await Page.findOne({ slug, _id: { $ne: req.params.id } });
      let counter = 1;
      while (existing) {
        slug = generateSlug(title) + '-' + counter;
        existing = await Page.findOne({ slug, _id: { $ne: req.params.id } });
        counter++;
      }
    }

    existingPage.title = title;
    existingPage.slug = slug;
    existingPage.content = content || '';
    existingPage.status = status || 'draft';
    existingPage.featuredImage = featuredImage || '';
    existingPage.seoTitle = seoTitle || '';
    existingPage.metaDescription = metaDescription || '';
    existingPage.focusKeyphrase = focusKeyphrase || '';
    existingPage.ogImage = ogImage || '';
    existingPage.ogTitle = ogTitle || '';
    existingPage.ogDescription = ogDescription || '';
    existingPage.canonicalUrl = canonicalUrl || '';
    existingPage.noindex = noindex === 'true';
    existingPage.breadcrumbTitle = breadcrumbTitle || '';
    await existingPage.save();

    res.redirect('/admin/pages');
  } catch (error) {
    console.error('updatePage error:', error);
    res.status(500).render('admin/error', { title: 'Error', message: 'Failed to update page.' });
  }
};

export const deletePage = async (req, res) => {
  try {
    await Page.findByIdAndDelete(req.params.id);
    res.redirect('/admin/pages');
  } catch (error) {
    console.error('deletePage error:', error);
    res.status(500).render('admin/error', { title: 'Error', message: 'Failed to delete page.' });
  }
};

// ─── Comments Management ─────────────────────────────────────────────────────

export const getComments = async (req, res) => {
  try {
    const status = req.query.status || '';
    const filter = {};
    if (status) filter.status = status;

    const comments = await Comment.find(filter)
      .populate('post', 'title slug')
      .sort({ createdAt: -1 })
      .lean();

    const counts = await Promise.all([
      Comment.countDocuments({ status: 'pending' }),
      Comment.countDocuments({ status: 'approved' }),
      Comment.countDocuments({ status: 'spam' }),
    ]);

    res.render('admin/comments/list', {
      title: 'Comments',
      comments,
      filterStatus: status,
      pendingCount: counts[0],
      approvedCount: counts[1],
      spamCount: counts[2],
    });
  } catch (error) {
    console.error('getComments error:', error);
    res.status(500).render('admin/error', { title: 'Error', message: 'Failed to load comments.' });
  }
};

export const approveComment = async (req, res) => {
  try {
    await Comment.findByIdAndUpdate(req.params.id, { status: 'approved' });
    AuditLog.log({
      action: 'approve',
      entity: 'comment',
      entityId: req.params.id,
      description: 'Approved comment',
      req,
    });
    res.redirect('/admin/comments');
  } catch (error) {
    console.error('approveComment error:', error);
    res
      .status(500)
      .render('admin/error', { title: 'Error', message: 'Failed to approve comment.' });
  }
};

export const spamComment = async (req, res) => {
  try {
    await Comment.findByIdAndUpdate(req.params.id, { status: 'spam' });
    res.redirect('/admin/comments');
  } catch (error) {
    console.error('spamComment error:', error);
    res
      .status(500)
      .render('admin/error', { title: 'Error', message: 'Failed to mark comment as spam.' });
  }
};

export const deleteComment = async (req, res) => {
  try {
    await Comment.findByIdAndDelete(req.params.id);
    AuditLog.log({
      action: 'delete',
      entity: 'comment',
      entityId: req.params.id,
      description: 'Deleted comment',
      req,
    });
    res.redirect('/admin/comments');
  } catch (error) {
    console.error('deleteComment error:', error);
    res.status(500).render('admin/error', { title: 'Error', message: 'Failed to delete comment.' });
  }
};

// ─── Media Library ───────────────────────────────────────────────────────────

export const getMedia = async (req, res) => {
  try {
    const mediaItems = await Media.find({}).sort({ createdAt: -1 }).lean();
    res.render('admin/media/index', { title: 'Media Library', mediaItems });
  } catch (error) {
    console.error('getMedia error:', error);
    res.status(500).render('admin/error', { title: 'Error', message: 'Failed to load media.' });
  }
};

export const uploadMedia = async (req, res) => {
  try {
    if (!req.file) {
      const mediaItems = await Media.find({}).sort({ createdAt: -1 }).lean();
      return res.render('admin/media/index', {
        title: 'Media Library',
        mediaItems,
        error: 'Please select a file to upload.',
      });
    }

    // Generate thumbnail for images
    let thumbnailPath = '';
    if (
      req.file.mimetype &&
      req.file.mimetype.startsWith('image/') &&
      req.file.mimetype !== 'image/svg+xml'
    ) {
      try {
        const sharp = (await import('sharp')).default;
        const fs = await import('fs/promises');
        const pathMod = await import('path');
        const { fileURLToPath } = await import('url');
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = pathMod.dirname(__filename);

        const thumbFilename = 'thumb_' + req.file.filename;
        const thumbDir = pathMod.join(__dirname, '..', '..', 'public', 'uploads', 'thumbnails');
        const thumbPath = pathMod.join(thumbDir, thumbFilename);

        await fs.mkdir(thumbDir, { recursive: true });
        await sharp(req.file.path)
          .resize(300, 200, { fit: 'cover', position: 'center' })
          .jpeg({ quality: 80 })
          .toFile(thumbPath);

        thumbnailPath = '/uploads/thumbnails/' + thumbFilename;
      } catch (sharpErr) {
        console.warn('Thumbnail generation skipped:', sharpErr.message);
      }
    }

    const media = await Media.create({
      originalName: req.file.originalname,
      filename: req.file.filename,
      path: '/uploads/' + req.file.filename,
      thumbnailPath,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedBy: req.session.userId,
    });

    AuditLog.log({
      action: 'upload',
      entity: 'media',
      entityId: media._id,
      description: `Uploaded: ${req.file.originalname}`,
      req,
    });

    res.redirect('/admin/media');
  } catch (error) {
    console.error('uploadMedia error:', error);
    const mediaItems = await Media.find({}).sort({ createdAt: -1 }).lean();
    res.render('admin/media/index', {
      title: 'Media Library',
      mediaItems,
      error: 'Failed to upload file.',
    });
  }
};

export const deleteMedia = async (req, res) => {
  try {
    const media = await Media.findByIdAndDelete(req.params.id);
    if (media) {
      const fs = await import('fs');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const filePath = path.join(__dirname, '..', '..', 'public', media.path);
      fs.unlink(filePath, () => {});
    }
    res.redirect('/admin/media');
  } catch (error) {
    console.error('deleteMedia error:', error);
    res.status(500).render('admin/error', { title: 'Error', message: 'Failed to delete media.' });
  }
};

// ─── Audit Logs ─────────────────────────────────────────────────────────────

export const getAuditLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 30;
    const skip = (page - 1) * limit;
    const action = req.query.action || '';
    const entity = req.query.entity || '';

    const filter = {};
    if (action) filter.action = action;
    if (entity) filter.entity = entity;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);
    const actions = ['create', 'update', 'delete', 'login', 'logout', 'upload', 'approve', 'spam'];
    const entities = ['post', 'page', 'category', 'tag', 'media', 'comment', 'user', 'setting'];

    res.render('admin/audit-logs/index', {
      title: 'Audit Logs',
      logs,
      currentPage: page,
      totalPages,
      total,
      filterAction: action,
      filterEntity: entity,
      actions,
      entities,
    });
  } catch (error) {
    console.error('getAuditLogs error:', error);
    res
      .status(500)
      .render('admin/error', { title: 'Error', message: 'Failed to load audit logs.' });
  }
};

// ─── Settings ────────────────────────────────────────────────────────────────

export const getSettings = async (req, res) => {
  try {
    const settings = await Setting.getSettings();
    res.render('admin/settings/index', {
      title: 'Settings',
      settings,
    });
  } catch (error) {
    console.error('getSettings error:', error);
    res.status(500).render('admin/error', { title: 'Error', message: 'Failed to load settings.' });
  }
};

export const updateSettings = async (req, res) => {
  try {
    const {
      siteName,
      siteTagline,
      postsPerPage,
      titleSeparator,
      homepageSeoTitle,
      homepageMetaDescription,
      homepageOgImage,
      twitterUsername,
      facebookUrl,
      noindexSite,
      navLabel,
      navUrl,
      navAutoPages,
    } = req.body;

    await Setting.setSetting('siteName', siteName || 'My Blog');
    await Setting.setSetting('siteTagline', siteTagline || '');
    await Setting.setSetting('postsPerPage', postsPerPage || '6');
    await Setting.setSetting('titleSeparator', titleSeparator || '|');
    await Setting.setSetting('homepageSeoTitle', homepageSeoTitle || '');
    await Setting.setSetting('homepageMetaDescription', homepageMetaDescription || '');
    await Setting.setSetting('homepageOgImage', homepageOgImage || '');
    await Setting.setSetting('twitterUsername', twitterUsername || '');
    await Setting.setSetting('facebookUrl', facebookUrl || '');
    // Handle noindexSite: with extended:true, duplicate keys become an array
    let noindexValue;
    if (Array.isArray(noindexSite)) {
      noindexValue = noindexSite.includes('true') ? 'true' : 'false';
    } else {
      noindexValue = noindexSite === 'true' ? 'true' : 'false';
    }
    await Setting.setSetting('noindexSite', noindexValue);

    // Navigation manager
    const navItems = [];
    if (Array.isArray(navLabel) && Array.isArray(navUrl)) {
      for (let i = 0; i < navLabel.length; i++) {
        const label = (navLabel[i] || '').trim();
        const url = (navUrl[i] || '').trim();
        if (label && url) {
          navItems.push({ label, url, order: i });
        }
      }
    }
    await Setting.setSetting('navigation', navItems);
    await Setting.setSetting('navAutoPages', navAutoPages === 'true' ? 'true' : 'false');

    // ─── Permalink settings ─────────────────────────────────────────────────
    const permalinkStructure = req.body.permalinkStructure || PERMALINK_PRESETS.default;
    const categoryBase =
      (req.body.categoryBase || 'category').replace(/^\/+|\/+$/g, '') || 'category';
    const tagBase = (req.body.tagBase || 'tag').replace(/^\/+|\/+$/g, '') || 'tag';
    const permalinkTrailingSlash = req.body.permalinkTrailingSlash === 'true' ? 'true' : 'false';

    // Validate the permalink structure
    const validation = validatePermalinkStructure(permalinkStructure);
    if (!validation.valid) {
      return res.status(400).render('admin/error', {
        title: 'Error',
        message: `Invalid permalink structure: ${validation.error}`,
      });
    }

    // If structure changed, store the old one for 301 redirects
    const currentStructure = await Setting.getSetting(
      'permalinkStructure',
      PERMALINK_PRESETS.default
    );
    if (currentStructure !== permalinkStructure) {
      await storeOldPermalinkStructure(currentStructure);
    }

    await Setting.setSetting('permalinkStructure', permalinkStructure);
    await Setting.setSetting('categoryBase', categoryBase);
    await Setting.setSetting('tagBase', tagBase);
    await Setting.setSetting('permalinkTrailingSlash', permalinkTrailingSlash);

    res.redirect('/admin/settings');
  } catch (error) {
    console.error('updateSettings error:', error);
    res
      .status(500)
      .render('admin/error', { title: 'Error', message: 'Failed to update settings.' });
  }
};

// ─── Navigation Management ──────────────────────────────────────────────────

export const getNavigation = async (req, res) => {
  try {
    const settings = await Setting.getSettings();
    res.render('admin/navigation/index', {
      title: 'Navigation',
      settings,
    });
  } catch (error) {
    console.error('getNavigation error:', error);
    res
      .status(500)
      .render('admin/error', { title: 'Error', message: 'Failed to load navigation.' });
  }
};

export const updateNavigation = async (req, res) => {
  try {
    const { navLabel, navUrl, navAutoPages } = req.body;

    const navItems = [];
    if (Array.isArray(navLabel) && Array.isArray(navUrl)) {
      for (let i = 0; i < navLabel.length; i++) {
        const label = (navLabel[i] || '').trim();
        const url = (navUrl[i] || '').trim();
        if (label && url) {
          navItems.push({ label, url, order: i });
        }
      }
    }
    await Setting.setSetting('navigation', navItems);
    await Setting.setSetting('navAutoPages', navAutoPages === 'true' ? 'true' : 'false');

    await AuditLog.log({
      action: 'update',
      entity: 'setting',
      description: 'Updated navigation links',
      req,
    });

    res.redirect('/admin/navigation');
  } catch (error) {
    console.error('updateNavigation error:', error);
    res
      .status(500)
      .render('admin/error', { title: 'Error', message: 'Failed to update navigation.' });
  }
};

// ─── User Management ─────────────────────────────────────────────────────────

export const getUsers = async (req, res) => {
  try {
    const users = await User.find({}).sort({ createdAt: -1 }).lean();
    res.render('admin/users/list', { title: 'Users', users });
  } catch (error) {
    console.error('getUsers error:', error);
    res.status(500).render('admin/error', { title: 'Error', message: 'Failed to load users.' });
  }
};

export const createUser = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password) {
      const users = await User.find({}).sort({ createdAt: -1 }).lean();
      return res.render('admin/users/list', {
        title: 'Users',
        users,
        error: 'Username, email, and password are required.',
      });
    }

    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      const users = await User.find({}).sort({ createdAt: -1 }).lean();
      return res.render('admin/users/list', {
        title: 'Users',
        users,
        error: 'A user with that email or username already exists.',
      });
    }

    await User.create({ username, email, password, role: role || 'author' });
    res.redirect('/admin/users');
  } catch (error) {
    console.error('createUser error:', error);
    res.status(500).render('admin/error', { title: 'Error', message: 'Failed to create user.' });
  }
};

export const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const targetUser = await User.findById(req.params.id);

    if (!targetUser) {
      return res.redirect('/admin/users');
    }

    // Prevent removing your own admin role
    if (
      targetUser._id.toString() === req.session.userId &&
      targetUser.role === 'admin' &&
      role !== 'admin'
    ) {
      const users = await User.find({}).sort({ createdAt: -1 }).lean();
      return res.render('admin/users/list', {
        title: 'Users',
        users,
        error: 'You cannot remove your own admin role.',
      });
    }

    targetUser.role = role;
    await targetUser.save();
    res.redirect('/admin/users');
  } catch (error) {
    console.error('updateUserRole error:', error);
    res.status(500).render('admin/error', { title: 'Error', message: 'Failed to update user.' });
  }
};

export const deleteUser = async (req, res) => {
  try {
    if (req.params.id === req.session.userId) {
      const users = await User.find({}).sort({ createdAt: -1 }).lean();
      return res.render('admin/users/list', {
        title: 'Users',
        users,
        error: 'You cannot delete your own account.',
      });
    }

    await User.findByIdAndDelete(req.params.id);
    res.redirect('/admin/users');
  } catch (error) {
    console.error('deleteUser error:', error);
    res.status(500).render('admin/error', { title: 'Error', message: 'Failed to delete user.' });
  }
};
