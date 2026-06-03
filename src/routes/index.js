import express from 'express';
import Setting from '../models/Setting.js';
import Post from '../models/Post.js';
import Page from '../models/Page.js';
import Category from '../models/Category.js';
import Tag from '../models/Tag.js';
import { getHome, search, getSiteData, seoMeta } from '../controllers/publicController.js';
import { permalinkCatchAll } from '../middleware/permalink.js';

const router = express.Router();

// Explicit public routes (not handled by permalink router)
router.get('/', getHome);
router.get('/search', search);

// robots.txt
router.get('/robots.txt', async (req, res) => {
  try {
    const noindexSite = await Setting.getSetting('noindexSite', 'false');
    const isNoindex = noindexSite === 'true' || noindexSite === true;
    const siteUrl = process.env.SITE_URL || `http://localhost:${process.env.PORT || 3000}`;

    let robots = 'User-agent: *\n';
    if (isNoindex) {
      robots += 'Disallow: /\n';
    } else {
      robots += 'Allow: /\n';
      robots += 'Disallow: /admin\n';
      robots += 'Disallow: /api\n';
    }
    robots += `\nSitemap: ${siteUrl}/sitemap.xml\n`;

    res.type('text/plain');
    res.send(robots);
  } catch (err) {
    res.type('text/plain');
    res.send('User-agent: *\nAllow: /\n');
  }
});

// RSS feed
router.get('/feed.xml', async (req, res) => {
  try {
    const [siteName, posts, allSettings] = await Promise.all([
      Setting.getSetting('siteName', 'My Blog'),
      Post.find({
        $or: [{ status: 'published' }, { status: 'scheduled', publishedAt: { $lte: new Date() } }],
      })
        .populate('author', 'username')
        .populate('categories', 'name slug')
        .sort({ publishedAt: -1 })
        .limit(20)
        .lean(),
      Setting.getSettings(),
    ]);
    const siteUrl = process.env.SITE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const { generatePostUrl, PERMALINK_PRESETS } = await import('../utils/permalink.js');
    const structure = allSettings.permalinkStructure || PERMALINK_PRESETS.default;

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">\n`;
    xml += `  <channel>\n`;
    xml += `    <title>${escapeXml(siteName)}</title>\n`;
    xml += `    <link>${siteUrl}</link>\n`;
    xml += `    <description>Latest posts from ${escapeXml(siteName)}</description>\n`;
    xml += `    <language>en-us</language>\n`;
    xml += `    <atom:link href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml"/>\n`;

    for (const post of posts) {
      const pubDate = post.publishedAt ? new Date(post.publishedAt).toUTCString() : '';
      const postUrl = generatePostUrl(post, structure);
      xml += `    <item>\n`;
      xml += `      <title>${escapeXml(post.title)}</title>\n`;
      xml += `      <link>${siteUrl}${postUrl}</link>\n`;
      xml += `      <guid isPermaLink="true">${siteUrl}${postUrl}</guid>\n`;
      xml += `      <description>${escapeXml(post.excerpt || post.title)}</description>\n`;
      if (pubDate) xml += `      <pubDate>${pubDate}</pubDate>\n`;
      if (post.author) xml += `      <author>${escapeXml(post.author.username)}</author>\n`;
      xml += `    </item>\n`;
    }

    xml += `  </channel>\n`;
    xml += `</rss>`;

    res.set('Content-Type', 'application/rss+xml; charset=utf-8');
    res.send(xml);
  } catch (err) {
    console.error('RSS feed error:', err);
    res.status(500).send('Error generating feed');
  }
});

// XML Sitemap
router.get('/sitemap.xml', async (req, res) => {
  try {
    const siteUrl = process.env.SITE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const today = new Date().toISOString().split('T')[0];
    const {
      generatePostUrl,
      generateCategoryUrl,
      generateTagUrl,
      generatePageUrl,
      PERMALINK_PRESETS,
    } = await import('../utils/permalink.js');
    const allSettings = await Setting.getSettings();
    const structure = allSettings.permalinkStructure || PERMALINK_PRESETS.default;
    const categoryBase = allSettings.categoryBase || 'category';
    const tagBase = allSettings.tagBase || 'tag';

    const [posts, pages, categories, tags] = await Promise.all([
      Post.find({ status: 'published' })
        .select('slug updatedAt publishedAt author categories')
        .sort({ updatedAt: -1 })
        .populate('categories', 'name slug')
        .lean(),
      Page.find({ status: 'published' }).select('slug updatedAt').sort({ updatedAt: -1 }).lean(),
      Category.find({}).select('slug').lean(),
      Tag.find({}).select('slug').lean(),
    ]);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // Homepage
    xml += `  <url><loc>${siteUrl}/</loc><priority>1.0</priority><changefreq>daily</changefreq></url>\n`;

    // Posts
    for (const p of posts) {
      const lastmod = p.updatedAt ? new Date(p.updatedAt).toISOString().split('T')[0] : today;
      const postUrl = generatePostUrl(p, structure);
      xml += `  <url><loc>${siteUrl}${postUrl}</loc><lastmod>${lastmod}</lastmod><priority>0.8</priority></url>\n`;
    }

    // Pages
    for (const p of pages) {
      const lastmod = p.updatedAt ? new Date(p.updatedAt).toISOString().split('T')[0] : today;
      const pageUrl = generatePageUrl(p);
      xml += `  <url><loc>${siteUrl}${pageUrl}</loc><lastmod>${lastmod}</lastmod><priority>0.7</priority></url>\n`;
    }

    // Categories
    for (const c of categories) {
      const catUrl = generateCategoryUrl(c, categoryBase);
      xml += `  <url><loc>${siteUrl}${catUrl}</loc><priority>0.5</priority></url>\n`;
    }

    // Tags
    for (const t of tags) {
      const tagUrl = generateTagUrl(t, tagBase);
      xml += `  <url><loc>${siteUrl}${tagUrl}</loc><priority>0.3</priority></url>\n`;
    }

    xml += `</urlset>`;

    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.send(xml);
  } catch (err) {
    console.error('Sitemap error:', err);
    res.status(500).send('Error generating sitemap');
  }
});

// Permalink-aware content routing — catch-all for public content pages
router.use(permalinkCatchAll);

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export default router;
