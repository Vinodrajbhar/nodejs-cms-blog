import Post from '../models/Post.js';
import Page from '../models/Page.js';
import Category from '../models/Category.js';
import Tag from '../models/Tag.js';
import Comment from '../models/Comment.js';
import Setting from '../models/Setting.js';
import {
  generatePostUrl,
  generateCategoryUrl,
  generateTagUrl,
  generatePageUrl,
  PERMALINK_PRESETS,
} from '../utils/permalink.js';

export const POSTS_PER_PAGE = 6;

// Helper to get site-wide data for all public views
export async function getSiteData() {
  const [siteName, categories, tags, pages, allSettings] = await Promise.all([
    Setting.getSetting('siteName', 'My Blog'),
    Category.find({}).sort({ name: 1 }).lean(),
    Tag.find({}).sort({ name: 1 }).lean(),
    Page.find({ status: 'published' }).select('title slug').sort({ createdAt: 1 }).lean(),
    Setting.getSettings(),
  ]);

  const structure = allSettings.permalinkStructure || PERMALINK_PRESETS.default;
  const categoryBase = allSettings.categoryBase || 'category';
  const tagBase = allSettings.tagBase || 'tag';

  return {
    siteName,
    categories,
    tags,
    pages,
    // Global SEO settings
    siteTagline: allSettings.siteTagline || '',
    titleSeparator: allSettings.titleSeparator || '|',
    homepageSeoTitle: allSettings.homepageSeoTitle || '',
    homepageMetaDescription: allSettings.homepageMetaDescription || '',
    homepageOgImage: allSettings.homepageOgImage || '',
    twitterUsername: allSettings.twitterUsername || '',
    facebookUrl: allSettings.facebookUrl || '',
    noindexSite: allSettings.noindexSite === 'true' || allSettings.noindexSite === true,
    siteUrl: process.env.SITE_URL || `http://localhost:${process.env.PORT || 3000}`,
    // Navigation
    navItems: Array.isArray(allSettings.navigation) ? allSettings.navigation : [],
    navAutoPages:
      allSettings.navAutoPages === 'true' ||
      allSettings.navAutoPages === true ||
      allSettings.navAutoPages === undefined,
    // Permalink helpers for views
    permalinkStructure: structure,
    categoryBase,
    tagBase,
    postUrl: (post) => generatePostUrl(post, structure),
    categoryUrl: (cat) => generateCategoryUrl(cat, categoryBase),
    tagUrl: (tag) => generateTagUrl(tag, tagBase),
    pageUrl: (page) => generatePageUrl(page),
  };
}

// Filter for published/scheduled posts visible to the public
export function publishedFilter() {
  return {
    $or: [{ status: 'published' }, { status: 'scheduled', publishedAt: { $lte: new Date() } }],
  };
}

// Make an image path absolute if it's relative
function absUrl(siteUrl, path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('/')) return siteUrl + path;
  return path;
}

// Compute SEO meta for a view
export function seoMeta(siteData, overrides = {}) {
  const {
    seoTitle,
    metaDescription,
    ogTitle,
    ogDescription,
    ogImage,
    canonicalUrl,
    noindex,
    ogType = 'website',
    twitterCard = 'summary_large_image',
    schema = null,
    breadcrumbTitle,
  } = overrides;

  const fullUrl = canonicalUrl || siteData.siteUrl + (overrides.path || '');
  const finalOgImage = absUrl(siteData.siteUrl, ogImage || siteData.homepageOgImage);

  return {
    pageSeoTitle: seoTitle || '',
    pageMetaDescription: metaDescription || siteData.siteTagline || siteData.siteName,
    pageOgTitle: ogTitle || seoTitle || '',
    pageOgDescription: ogDescription || metaDescription || siteData.siteTagline || '',
    pageOgImage: finalOgImage,
    pageCanonical: fullUrl || siteData.siteUrl,
    pageNoindex: noindex || siteData.noindexSite,
    ogType,
    twitterCardType: twitterCard,
    pageSchema: schema,
    searchUrl: siteData.siteUrl + '/search',
    siteUrl: siteData.siteUrl,
    twitterUsername: siteData.twitterUsername,
  };
}

export const getHome = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * POSTS_PER_PAGE;

    const publishedQ = {
      $or: [{ status: 'published' }, { status: 'scheduled', publishedAt: { $lte: new Date() } }],
    };
    const [posts, totalPosts, siteData] = await Promise.all([
      Post.find(publishedQ)
        .populate('author', 'username')
        .populate('categories', 'name slug')
        .populate('tags', 'name slug')
        .sort({ publishedAt: -1 })
        .skip(skip)
        .limit(POSTS_PER_PAGE)
        .lean(),
      Post.countDocuments(publishedQ),
      getSiteData(),
    ]);

    const totalPages = Math.ceil(totalPosts / POSTS_PER_PAGE);

    const meta = seoMeta(siteData, {
      seoTitle: siteData.homepageSeoTitle || siteData.siteName,
      metaDescription:
        siteData.homepageMetaDescription ||
        siteData.siteTagline ||
        siteData.siteName + ' — A blog.',
      ogImage: siteData.homepageOgImage,
      path: '/',
    });

    res.render('public/index', {
      title: '',
      ...siteData,
      ...meta,
      posts,
      currentPage: page,
      totalPages,
    });
  } catch (error) {
    console.error('Home error:', error);
    res.status(500).send('Server error');
  }
};

export const getPost = async (req, res) => {
  try {
    const post = await Post.findOne({
      slug: req.params.slug,
      $or: [{ status: 'published' }, { status: 'scheduled', publishedAt: { $lte: new Date() } }],
    })
      .populate('author', 'username')
      .populate('categories', 'name slug')
      .populate('tags', 'name slug')
      .lean();

    if (!post) {
      return res.status(404).render('public/error', {
        title: 'Not Found',
        message: 'Post not found.',
        ...(await getSiteData()),
      });
    }

    const comments = await Comment.find({ post: post._id, status: 'approved' })
      .sort({ createdAt: -1 })
      .lean();

    const siteData = await getSiteData();

    // Article JSON-LD schema
    const articleSchema = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.seoTitle || post.title,
      description: post.metaDescription || post.excerpt || post.title,
      image: post.ogImage || post.featuredImage || siteData.homepageOgImage || undefined,
      datePublished: post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined,
      dateModified: post.updatedAt ? new Date(post.updatedAt).toISOString() : undefined,
      author: {
        '@type': 'Person',
        name: post.author ? post.author.username : 'Anonymous',
      },
    });

    const meta = seoMeta(siteData, {
      seoTitle: post.seoTitle || post.title,
      metaDescription: post.metaDescription || post.excerpt || post.title,
      ogTitle: post.ogTitle || post.seoTitle || post.title,
      ogDescription: post.ogDescription || post.metaDescription || post.excerpt || post.title,
      ogImage: post.ogImage || post.featuredImage || siteData.homepageOgImage,
      canonicalUrl: post.canonicalUrl || undefined,
      noindex: post.noindex || false,
      ogType: 'article',
      twitterCard: 'summary_large_image',
      schema: '<script type="application/ld+json">' + articleSchema + '</script>',
      path: '/post/' + post.slug,
    });

    res.render('public/post', {
      title: post.title,
      ...siteData,
      ...meta,
      post,
      comments,
    });
  } catch (error) {
    console.error('Post error:', error);
    res.status(500).send('Server error');
  }
};

export const getPage = async (req, res) => {
  try {
    const page = await Page.findOne({ slug: req.params.slug, status: 'published' })
      .populate('author', 'username')
      .lean();

    if (!page) {
      return res.status(404).render('public/error', {
        title: 'Not Found',
        message: 'Page not found.',
        ...(await getSiteData()),
      });
    }

    const siteData = await getSiteData();

    const meta = seoMeta(siteData, {
      seoTitle: page.seoTitle || page.title,
      metaDescription: page.metaDescription || page.title,
      ogTitle: page.ogTitle || page.seoTitle || page.title,
      ogDescription: page.ogDescription || page.metaDescription || page.title,
      ogImage: page.ogImage || page.featuredImage || siteData.homepageOgImage,
      canonicalUrl: page.canonicalUrl || undefined,
      noindex: page.noindex || false,
      ogType: 'website',
      twitterCard: 'summary',
      path: '/page/' + page.slug,
    });

    res.render('public/page', {
      title: page.title,
      ...siteData,
      ...meta,
      page,
    });
  } catch (error) {
    console.error('Page error:', error);
    res.status(500).send('Server error');
  }
};

export const getCategory = async (req, res) => {
  try {
    const category = await Category.findOne({ slug: req.params.slug }).lean();
    if (!category) {
      return res.status(404).render('public/error', {
        title: 'Not Found',
        message: 'Category not found.',
        ...(await getSiteData()),
      });
    }

    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * POSTS_PER_PAGE;

    const [posts, totalPosts, siteData] = await Promise.all([
      Post.find({
        categories: category._id,
        $or: [{ status: 'published' }, { status: 'scheduled', publishedAt: { $lte: new Date() } }],
      })
        .populate('author', 'username')
        .populate('categories', 'name slug')
        .populate('tags', 'name slug')
        .sort({ publishedAt: -1 })
        .skip(skip)
        .limit(POSTS_PER_PAGE)
        .lean(),
      Post.countDocuments({
        categories: category._id,
        $or: [{ status: 'published' }, { status: 'scheduled', publishedAt: { $lte: new Date() } }],
      }),
      getSiteData(),
    ]);

    const totalPages = Math.ceil(totalPosts / POSTS_PER_PAGE);

    const meta = seoMeta(siteData, {
      seoTitle: category.seoTitle || `Category: ${category.name}`,
      metaDescription:
        category.metaDescription || category.description || `Posts in category: ${category.name}`,
      ogImage: category.ogImage || siteData.homepageOgImage,
      noindex: category.noindex || false,
      ogType: 'website',
      twitterCard: 'summary',
      path: '/category/' + category.slug,
    });

    res.render('public/index', {
      title: `Category: ${category.name}`,
      ...siteData,
      ...meta,
      posts,
      currentPage: page,
      totalPages,
      currentCategory: category,
    });
  } catch (error) {
    console.error('Category error:', error);
    res.status(500).send('Server error');
  }
};

export const getTag = async (req, res) => {
  try {
    const tag = await Tag.findOne({ slug: req.params.slug }).lean();
    if (!tag) {
      return res.status(404).render('public/error', {
        title: 'Not Found',
        message: 'Tag not found.',
        ...(await getSiteData()),
      });
    }

    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * POSTS_PER_PAGE;

    const [posts, totalPosts, siteData] = await Promise.all([
      Post.find({
        tags: tag._id,
        $or: [{ status: 'published' }, { status: 'scheduled', publishedAt: { $lte: new Date() } }],
      })
        .populate('author', 'username')
        .populate('categories', 'name slug')
        .populate('tags', 'name slug')
        .sort({ publishedAt: -1 })
        .skip(skip)
        .limit(POSTS_PER_PAGE)
        .lean(),
      Post.countDocuments({
        tags: tag._id,
        $or: [{ status: 'published' }, { status: 'scheduled', publishedAt: { $lte: new Date() } }],
      }),
      getSiteData(),
    ]);

    const totalPages = Math.ceil(totalPosts / POSTS_PER_PAGE);

    const meta = seoMeta(siteData, {
      seoTitle: tag.seoTitle || `Tag: ${tag.name}`,
      metaDescription: tag.metaDescription || `Posts tagged: ${tag.name}`,
      noindex: tag.noindex || false,
      ogType: 'website',
      twitterCard: 'summary',
      path: '/tag/' + tag.slug,
    });

    res.render('public/index', {
      title: `Tag: ${tag.name}`,
      ...siteData,
      ...meta,
      posts,
      currentPage: page,
      totalPages,
      currentTag: tag,
    });
  } catch (error) {
    console.error('Tag error:', error);
    res.status(500).send('Server error');
  }
};

export const search = async (req, res) => {
  try {
    const query = (req.query.q || '').trim();
    if (!query) {
      const siteData = await getSiteData();
      const meta = seoMeta(siteData, {
        seoTitle: 'Search',
        metaDescription: 'Search the blog',
        ogType: 'website',
        twitterCard: 'summary',
        path: '/search',
      });
      return res.render('public/search', {
        title: 'Search',
        ...siteData,
        ...meta,
        query: '',
        posts: [],
      });
    }

    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * POSTS_PER_PAGE;

    const [posts, totalPosts, siteData] = await Promise.all([
      Post.find({
        $or: [{ status: 'published' }, { status: 'scheduled', publishedAt: { $lte: new Date() } }],
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { content: { $regex: query, $options: 'i' } },
          { excerpt: { $regex: query, $options: 'i' } },
        ],
      })
        .populate('author', 'username')
        .populate('categories', 'name slug')
        .populate('tags', 'name slug')
        .sort({ publishedAt: -1 })
        .skip(skip)
        .limit(POSTS_PER_PAGE)
        .lean(),
      Post.countDocuments({
        $or: [{ status: 'published' }, { status: 'scheduled', publishedAt: { $lte: new Date() } }],
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { content: { $regex: query, $options: 'i' } },
          { excerpt: { $regex: query, $options: 'i' } },
        ],
      }),
      getSiteData(),
    ]);

    const totalPages = Math.ceil(totalPosts / POSTS_PER_PAGE);

    const meta = seoMeta(siteData, {
      seoTitle: `Search: ${query}`,
      metaDescription: `Search results for: ${query}`,
      ogType: 'website',
      twitterCard: 'summary',
      noindex: true,
      path: '/search',
    });

    res.render('public/search', {
      title: `Search: ${query}`,
      ...siteData,
      ...meta,
      query,
      posts,
      currentPage: page,
      totalPages,
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).send('Server error');
  }
};
