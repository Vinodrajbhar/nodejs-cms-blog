import Post from '../models/Post.js';
import Page from '../models/Page.js';
import Category from '../models/Category.js';
import Tag from '../models/Tag.js';
import Comment from '../models/Comment.js';
import Setting from '../models/Setting.js';
import mongoose from 'mongoose';
import {
  buildAllMatchers,
  matchAgainstOldStructures,
  getOldPermalinkStructures,
} from '../utils/permalink.js';
import {
  getSiteData,
  seoMeta,
  publishedFilter,
  POSTS_PER_PAGE,
} from '../controllers/publicController.js';

// ─── Route handlers (used by the permalink router) ────────────────────────

async function handlePost(req, res, params) {
  try {
    const slug = params.postname || params.slug || params.post_id;
    let query;

    if (params.post_id) {
      query = { _id: params.post_id, ...publishedFilter() };
    } else {
      query = { slug, ...publishedFilter() };
    }

    const post = await Post.findOne(query)
      .populate('author', 'username')
      .populate('categories', 'name slug')
      .populate('tags', 'name slug')
      .lean();

    if (!post) {
      return handle404(req, res);
    }

    const comments = await Comment.find({ post: post._id, status: 'approved' })
      .sort({ createdAt: -1 })
      .lean();

    const siteData = await getSiteData();
    const url = siteData.postUrl(post);

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
      path: url,
    });

    res.render('public/post', {
      title: post.title,
      ...siteData,
      ...meta,
      post,
      comments,
    });
  } catch (error) {
    console.error('Permalink post error:', error);
    res.status(500).send('Server error');
  }
}

async function handlePage(req, res, params) {
  try {
    const page = await Page.findOne({ slug: params.slug, status: 'published' })
      .populate('author', 'username')
      .lean();

    if (!page) {
      return handle404(req, res);
    }

    const siteData = await getSiteData();
    const url = siteData.pageUrl(page);

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
      path: url,
    });

    res.render('public/page', {
      title: page.title,
      ...siteData,
      ...meta,
      page,
    });
  } catch (error) {
    console.error('Permalink page error:', error);
    res.status(500).send('Server error');
  }
}

async function handleCategory(req, res, params) {
  try {
    const category = await Category.findOne({ slug: params.slug }).lean();
    if (!category) {
      return handle404(req, res);
    }

    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * POSTS_PER_PAGE;
    const siteData = await getSiteData();

    const [posts, totalPosts] = await Promise.all([
      Post.find({ categories: category._id, ...publishedFilter() })
        .populate('author', 'username')
        .populate('categories', 'name slug')
        .populate('tags', 'name slug')
        .sort({ publishedAt: -1 })
        .skip(skip)
        .limit(POSTS_PER_PAGE)
        .lean(),
      Post.countDocuments({ categories: category._id, ...publishedFilter() }),
    ]);

    const totalPages = Math.ceil(totalPosts / POSTS_PER_PAGE);
    const url = siteData.categoryUrl(category);

    const meta = seoMeta(siteData, {
      seoTitle: category.seoTitle || `Category: ${category.name}`,
      metaDescription:
        category.metaDescription || category.description || `Posts in category: ${category.name}`,
      ogImage: category.ogImage || siteData.homepageOgImage,
      noindex: category.noindex || false,
      ogType: 'website',
      twitterCard: 'summary',
      path: url,
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
    console.error('Permalink category error:', error);
    res.status(500).send('Server error');
  }
}

async function handleTag(req, res, params) {
  try {
    const tag = await Tag.findOne({ slug: params.slug }).lean();
    if (!tag) {
      return handle404(req, res);
    }

    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * POSTS_PER_PAGE;
    const siteData = await getSiteData();

    const [posts, totalPosts] = await Promise.all([
      Post.find({ tags: tag._id, ...publishedFilter() })
        .populate('author', 'username')
        .populate('categories', 'name slug')
        .populate('tags', 'name slug')
        .sort({ publishedAt: -1 })
        .skip(skip)
        .limit(POSTS_PER_PAGE)
        .lean(),
      Post.countDocuments({ tags: tag._id, ...publishedFilter() }),
    ]);

    const totalPages = Math.ceil(totalPosts / POSTS_PER_PAGE);
    const url = siteData.tagUrl(tag);

    const meta = seoMeta(siteData, {
      seoTitle: tag.seoTitle || `Tag: ${tag.name}`,
      metaDescription: tag.metaDescription || `Posts tagged: ${tag.name}`,
      noindex: tag.noindex || false,
      ogType: 'website',
      twitterCard: 'summary',
      path: url,
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
    console.error('Permalink tag error:', error);
    res.status(500).send('Server error');
  }
}

async function handleYearArchive(req, res, params) {
  try {
    const year = parseInt(params.year);
    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);

    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * POSTS_PER_PAGE;
    const siteData = await getSiteData();

    const dateFilter = {
      ...publishedFilter(),
      publishedAt: { $gte: start, $lt: end },
    };

    const [posts, totalPosts] = await Promise.all([
      Post.find(dateFilter)
        .populate('author', 'username')
        .populate('categories', 'name slug')
        .populate('tags', 'name slug')
        .sort({ publishedAt: -1 })
        .skip(skip)
        .limit(POSTS_PER_PAGE)
        .lean(),
      Post.countDocuments(dateFilter),
    ]);

    const totalPages = Math.ceil(totalPosts / POSTS_PER_PAGE);
    const path = `/${year}/`;

    const meta = seoMeta(siteData, {
      seoTitle: `Year: ${year}`,
      metaDescription: `Posts from ${year}`,
      ogType: 'website',
      twitterCard: 'summary',
      path,
    });

    res.render('public/index', {
      title: `Year: ${year}`,
      ...siteData,
      ...meta,
      posts,
      currentPage: page,
      totalPages,
      archiveTitle: `Posts from ${year}`,
    });
  } catch (error) {
    console.error('Year archive error:', error);
    res.status(500).send('Server error');
  }
}

async function handleMonthArchive(req, res, params) {
  try {
    const year = parseInt(params.year);
    const month = parseInt(params.monthnum);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * POSTS_PER_PAGE;
    const siteData = await getSiteData();

    const dateFilter = {
      ...publishedFilter(),
      publishedAt: { $gte: start, $lt: end },
    };

    const [posts, totalPosts] = await Promise.all([
      Post.find(dateFilter)
        .populate('author', 'username')
        .populate('categories', 'name slug')
        .populate('tags', 'name slug')
        .sort({ publishedAt: -1 })
        .skip(skip)
        .limit(POSTS_PER_PAGE)
        .lean(),
      Post.countDocuments(dateFilter),
    ]);

    const totalPages = Math.ceil(totalPosts / POSTS_PER_PAGE);
    const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
    const path = `/${year}/${String(month).padStart(2, '0')}/`;

    const meta = seoMeta(siteData, {
      seoTitle: `Month: ${monthName} ${year}`,
      metaDescription: `Posts from ${monthName} ${year}`,
      ogType: 'website',
      twitterCard: 'summary',
      path,
    });

    res.render('public/index', {
      title: `${monthName} ${year}`,
      ...siteData,
      ...meta,
      posts,
      currentPage: page,
      totalPages,
      archiveTitle: `${monthName} ${year}`,
    });
  } catch (error) {
    console.error('Month archive error:', error);
    res.status(500).send('Server error');
  }
}

async function handleDayArchive(req, res, params) {
  try {
    const year = parseInt(params.year);
    const month = parseInt(params.monthnum);
    const day = parseInt(params.day);
    const start = new Date(year, month - 1, day);
    const end = new Date(year, month - 1, day + 1);

    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * POSTS_PER_PAGE;
    const siteData = await getSiteData();

    const dateFilter = {
      ...publishedFilter(),
      publishedAt: { $gte: start, $lt: end },
    };

    const [posts, totalPosts] = await Promise.all([
      Post.find(dateFilter)
        .populate('author', 'username')
        .populate('categories', 'name slug')
        .populate('tags', 'name slug')
        .sort({ publishedAt: -1 })
        .skip(skip)
        .limit(POSTS_PER_PAGE)
        .lean(),
      Post.countDocuments(dateFilter),
    ]);

    const totalPages = Math.ceil(totalPosts / POSTS_PER_PAGE);
    const dateStr = new Date(year, month - 1, day).toLocaleDateString('default', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const path = `/${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/`;

    const meta = seoMeta(siteData, {
      seoTitle: `Archive: ${dateStr}`,
      metaDescription: `Posts from ${dateStr}`,
      ogType: 'website',
      twitterCard: 'summary',
      path,
    });

    res.render('public/index', {
      title: dateStr,
      ...siteData,
      ...meta,
      posts,
      currentPage: page,
      totalPages,
      archiveTitle: dateStr,
    });
  } catch (error) {
    console.error('Day archive error:', error);
    res.status(500).send('Server error');
  }
}

// ─── 404 handler with old-URL redirect ───────────────────────────────────

async function handle404(req, res) {
  try {
    const siteName = await Setting.getSetting('siteName', 'My Blog');
    res.status(404).render('public/error', {
      title: 'Page Not Found',
      message: 'The page you are looking for does not exist.',
      siteName,
    });
  } catch (error) {
    console.error('404 handler error:', error);
    if (!res.headersSent) res.status(500).send('Server error');
  }
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Main permalink router middleware ──────────────────────────────────

/**
 * Catch-all middleware that resolves public content URLs using the current
 * permalink settings. Used after all explicit public routes.
 */
export async function permalinkCatchAll(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).send('Method Not Allowed');
  }

  const urlPath = req.path;
  if (
    /\.(css|js|png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot|map|json)$/i.test(urlPath) ||
    /^\/(favicon\.|apple-touch)/.test(urlPath)
  ) {
    return res.status(404).send('Not found');
  }

  try {
    const allSettings = await Setting.getSettings();
    const matchers = buildAllMatchers(allSettings);

    for (const matcher of matchers) {
      const match = urlPath.match(matcher.regex);
      if (!match) continue;

      const params = {};
      if (matcher.params.length === 1 && match[1]) {
        params[matcher.params[0]] = match[1];
      } else {
        matcher.params.forEach((name, idx) => {
          const val = match[idx + 1];
          if (val) params[name] = val;
        });
      }

      try {
        switch (matcher.handler) {
          case 'page': return await handlePage(req, res, params);
          case 'post': return await handlePost(req, res, params);
          case 'category': return await handleCategory(req, res, params);
          case 'tag': return await handleTag(req, res, params);
          case 'year_archive': return await handleYearArchive(req, res, params);
          case 'month_archive': return await handleMonthArchive(req, res, params);
          case 'day_archive': return await handleDayArchive(req, res, params);
        }
      } catch (handlerErr) {
        console.error(`[Permalink] ${matcher.handler} error:`, handlerErr.message);
      }
    }

    return await handle404(req, res);
  } catch (error) {
    console.error('[Permalink] Router error:', error);
    if (!res.headersSent) res.status(500).send('Server error');
  }
}
