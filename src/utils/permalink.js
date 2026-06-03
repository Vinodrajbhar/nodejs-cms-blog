import Setting from '../models/Setting.js';

/**
 * Structure tags and their regex patterns for permalink parsing.
 * Each tag maps to a named capture group regex.
 */
const STRUCTURE_TAGS = {
  '%postname%': '(?<postname>[^/]+)',
  '%post_id%': '(?<post_id>\\d+)',
  '%year%': '(?<year>\\d{4})',
  '%monthnum%': '(?<monthnum>0[1-9]|1[0-2])',
  '%day%': '(?<day>0[1-9]|[12]\\d|3[01])',
  '%category%': '(?<category>[^/]+)',
  '%author%': '(?<author>[^/]+)',
};

const TAG_NAMES = Object.keys(STRUCTURE_TAGS);

/**
 * Preset permalink structures matching WordPress conventions.
 */
export const PERMALINK_PRESETS = {
  default: '/post/%postname%/',
  postname: '/%postname%/',
  day_name: '/%year%/%monthnum%/%day%/%postname%/',
  month_name: '/%year%/%monthnum%/%postname%/',
  numeric: '/archives/%post_id%/',
};

/**
 * Parse a permalink structure string into a regex pattern and parameter list.
 *
 * @param {string} structure - e.g. '/%year%/%monthnum%/%postname%/'
 * @returns {{ regex: RegExp, params: string[], hasDate: boolean, hasCategory: boolean }}
 */
export function parsePermalinkStructure(structure) {
  if (!structure) {
    return parsePermalinkStructure(PERMALINK_PRESETS.default);
  }

  // Normalize: ensure leading slash, strip trailing slash for regex building
  let normalized = structure.trim();
  if (!normalized.startsWith('/')) normalized = '/' + normalized;
  const hasTrailingSlash = normalized.endsWith('/');

  // Build regex by replacing each tag with its pattern
  let regexStr = normalized;
  const params = [];
  const usedTags = new Set();

  for (const tag of TAG_NAMES) {
    if (regexStr.includes(tag)) {
      regexStr = regexStr.replace(new RegExp(tag.replace('%', '\\%'), 'g'), STRUCTURE_TAGS[tag]);
      const paramName = tag.replace(/%/g, '');
      params.push(paramName);
      usedTags.add(paramName);
    }
  }

  // Escape any remaining non-alphanumeric characters (except /)
  // But we've already replaced known tags, so any remaining % signs are literal
  // Convert to full regex: escape special regex chars except our capture groups
  // The regexStr now contains named groups like (?<postname>...)
  // We need to escape anything that isn't part of a capture group or /

  // Build the full regex pattern
  // 1. Escape special chars in literal parts
  // 2. Keep named groups intact
  let finalRegexStr = '';
  let i = 0;
  while (i < regexStr.length) {
    if (regexStr.substring(i).startsWith('(?<')) {
      // Find the end of this named group
      const endIdx = findClosingParen(regexStr, i);
      finalRegexStr += regexStr.substring(i, endIdx + 1);
      i = endIdx + 1;
    } else {
      const ch = regexStr[i];
      if ('\\^$.*+?{}[]|'.includes(ch)) {
        finalRegexStr += '\\' + ch;
      } else {
        finalRegexStr += ch;
      }
      i++;
    }
  }

  // Make trailing slash optional and allow end of string
  if (hasTrailingSlash) {
    // pattern ends with /, make the trailing slash optional but allow end
    finalRegexStr = finalRegexStr.replace(/\/$/, '/?');
  } else {
    finalRegexStr = finalRegexStr.replace(/\/?$/, '/?');
  }

  const regex = new RegExp(`^${finalRegexStr}$`);

  return {
    regex,
    params,
    hasDate: usedTags.has('year') || usedTags.has('monthnum') || usedTags.has('day'),
    hasCategory: usedTags.has('category'),
  };
}

function findClosingParen(str, start) {
  let depth = 1;
  let i = start + 1;
  while (i < str.length && depth > 0) {
    if (str[i] === '(' && str[i - 1] !== '\\') depth++;
    else if (str[i] === ')' && str[i - 1] !== '\\') depth--;
    if (depth > 0) i++;
  }
  return i;
}

/**
 * Build all URL matchers for the public routing middleware.
 * Returns an ordered array of matcher configs.
 *
 * @param {object} settings - All CMS settings
 * @returns {Array<{ type: string, regex: RegExp, params: string[], handler: string }>}
 */
export function buildAllMatchers(settings) {
  const structure = settings.permalinkStructure || PERMALINK_PRESETS.default;
  const categoryBase = (settings.categoryBase || 'category').replace(/^\/+|\/+$/g, '');
  const tagBase = (settings.tagBase || 'tag').replace(/^\/+|\/+$/g, '');
  const parsed = parsePermalinkStructure(structure);
  const matchers = [];

  // 1. Page matcher — always at /:slug
  matchers.push({
    type: 'page',
    regex: /^\/([^/]+)\/?$/,
    params: ['slug'],
    handler: 'page',
  });

  // 2. Post matcher — from the permalink structure
  // We need to extract just the post-matching part of the regex
  // But for the catch-all, we use the full regex
  const postRegexStr = parsed.regex.source;
  // The regex needs to be wrapped with ^$ which it already has from parsePermalinkStructure
  matchers.push({
    type: 'post',
    regex: parsed.regex,
    params: parsed.params,
    handler: 'post',
  });

  // 3. Category matcher
  if (categoryBase) {
    matchers.push({
      type: 'category',
      regex: new RegExp(`^\\/${escapeRegex(categoryBase)}\\/([^/]+)\\/?$`),
      params: ['slug'],
      handler: 'category',
    });
  }

  // 4. Tag matcher
  if (tagBase) {
    matchers.push({
      type: 'tag',
      regex: new RegExp(`^\\/${escapeRegex(tagBase)}\\/([^/]+)\\/?$`),
      params: ['slug'],
      handler: 'tag',
    });
  }

  // 5. Date archive matchers (only if structure has date tags)
  if (parsed.hasDate) {
    matchers.push({
      type: 'year_archive',
      regex: /^\/(\d{4})\/?$/,
      params: ['year'],
      handler: 'year_archive',
    });
    matchers.push({
      type: 'month_archive',
      regex: /^\/(\d{4})\/(0[1-9]|1[0-2])\/?$/,
      params: ['year', 'monthnum'],
      handler: 'month_archive',
    });
    matchers.push({
      type: 'day_archive',
      regex: /^\/(\d{4})\/(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/?$/,
      params: ['year', 'monthnum', 'day'],
      handler: 'day_archive',
    });
  }

  return matchers;
}

/**
 * Generate a full URL for a post based on the permalink structure.
 *
 * @param {object} post - Post document (with slug, publishedAt, _id, author, categories)
 * @param {string} structure - Permalink structure pattern
 * @returns {string} Resolved URL path
 */
export function generatePostUrl(post, structure) {
  if (!structure) structure = PERMALINK_PRESETS.default;

  let url = structure.trim();

  url = url.replace(/%postname%/g, post.slug || '');
  url = url.replace(/%post_id%/g, post._id ? post._id.toString() : '');

  if (post.publishedAt) {
    const d = new Date(post.publishedAt);
    const year = d.getFullYear().toString();
    const monthnum = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    url = url.replace(/%year%/g, year);
    url = url.replace(/%monthnum%/g, monthnum);
    url = url.replace(/%day%/g, day);
  }

  if (post.author && typeof post.author === 'object' && post.author.username) {
    url = url.replace(/%author%/g, post.author.username);
  } else if (post.author && typeof post.author === 'string') {
    url = url.replace(/%author%/g, post.author);
  }

  // %category% — use first category if available
  if (url.includes('%category%')) {
    if (post.categories && post.categories.length > 0) {
      const firstCat = post.categories[0];
      const catSlug = typeof firstCat === 'object' ? firstCat.slug : firstCat;
      url = url.replace(/%category%/g, catSlug || 'uncategorized');
    } else {
      url = url.replace(/%category%/g, 'uncategorized');
    }
  }

  // Normalize: collapse double slashes, ensure leading /
  url = url.replace(/\/+/g, '/');
  if (!url.startsWith('/')) url = '/' + url;

  return url;
}

/**
 * Generate a URL for a category.
 *
 * @param {object} category - Category document with slug
 * @param {string} categoryBase - Category base prefix (e.g. 'category')
 * @returns {string} URL path
 */
export function generateCategoryUrl(category, categoryBase) {
  const base = (categoryBase || 'category').replace(/^\/+|\/+$/g, '');
  if (!base) return `/${category.slug}/`;
  return `/${base}/${category.slug}/`;
}

/**
 * Generate a URL for a tag.
 *
 * @param {object} tag - Tag document with slug
 * @param {string} tagBase - Tag base prefix (e.g. 'tag')
 * @returns {string} URL path
 */
export function generateTagUrl(tag, tagBase) {
  const base = (tagBase || 'tag').replace(/^\/+|\/+$/g, '');
  if (!base) return `/${tag.slug}/`;
  return `/${base}/${tag.slug}/`;
}

/**
 * Generate a URL for a page. Pages are always at /:slug.
 *
 * @param {object} page - Page document with slug
 * @returns {string} URL path
 */
export function generatePageUrl(page) {
  return `/${page.slug}/`;
}

/**
 * Store the previous permalink structure for 301 redirect support.
 * Keeps up to MAX_OLD_STRUCTURES old structures.
 *
 * @param {string} oldStructure - The previous permalink structure
 */
export async function storeOldPermalinkStructure(oldStructure) {
  const MAX_OLD_STRUCTURES = 5;
  const existing = await Setting.getSetting('previousPermalinkStructures', []);
  if (!Array.isArray(existing)) {
    await Setting.setSetting('previousPermalinkStructures', [oldStructure]);
    return;
  }
  // Don't duplicate
  if (existing.includes(oldStructure)) return;
  existing.push(oldStructure);
  // Keep only the most recent MAX_OLD_STRUCTURES
  while (existing.length > MAX_OLD_STRUCTURES) {
    existing.shift();
  }
  await Setting.setSetting('previousPermalinkStructures', existing);
}

/**
 * Get previously-used permalink structures for 301 redirect matching.
 *
 * @returns {Promise<string[]>} Array of old structure strings
 */
export async function getOldPermalinkStructures() {
  const structures = await Setting.getSetting('previousPermalinkStructures', []);
  return Array.isArray(structures) ? structures : [];
}

/**
 * Try to match a URL against old permalink structures.
 * If matched, extracts the slug and returns it with the matched structure.
 *
 * @param {string} urlPath - The URL path to match
 * @param {string[]} oldStructures - Old permalink structures to try
 * @returns {object|null} { slug, postId, structure } or null
 */
export function matchAgainstOldStructures(urlPath, oldStructures) {
  for (const structure of oldStructures) {
    const parsed = parsePermalinkStructure(structure);
    const match = urlPath.match(parsed.regex);
    if (match) {
      const result = { structure };
      if (match.groups) {
        if (match.groups.postname) result.slug = match.groups.postname;
        if (match.groups.post_id) result.postId = match.groups.post_id;
      }
      if (result.slug || result.postId) return result;
    }
  }
  return null;
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validate whether a custom permalink structure is valid.
 *
 * @param {string} structure - The structure to validate
 * @returns {{ valid: boolean, error?: string }}
 */
export function validatePermalinkStructure(structure) {
  if (!structure || !structure.trim()) {
    return { valid: false, error: 'Structure cannot be empty.' };
  }

  // Must contain at least one content-identifying tag
  const contentTags = ['%postname%', '%post_id%'];
  const hasContentTag = contentTags.some((tag) => structure.includes(tag));
  if (!hasContentTag) {
    return {
      valid: false,
      error: 'Structure must contain %postname% or %post_id% to identify individual posts.',
    };
  }

  // Must not contain invalid characters
  if (/[<>"']/.test(structure)) {
    return { valid: false, error: 'Structure contains invalid characters.' };
  }

  return { valid: true };
}
