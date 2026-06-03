import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Theme from '../models/Theme.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

/**
 * Middleware: Injects active theme data into res.locals for all public views.
 * This makes `activeTheme` and `themeAssets` available in every view.
 */
export async function injectThemeData(req, res, next) {
  try {
    const activeTheme = await Theme.getActive();
    if (activeTheme) {
      res.locals.activeTheme = activeTheme;
      res.locals.themeAssets = {
        css: `/assets/theme/css/theme.css`,
        js: `/assets/theme/js/theme.js`,
      };

      // Check if custom CSS/JS files actually exist
      const cssPath = path.resolve(
        PROJECT_ROOT,
        'themes',
        activeTheme.slug,
        'assets/css/theme.css'
      );
      const jsPath = path.resolve(PROJECT_ROOT, 'themes', activeTheme.slug, 'assets/js/theme.js');

      res.locals.themeAssets.hasCss = fs.existsSync(cssPath);
      res.locals.themeAssets.hasJs = fs.existsSync(jsPath);
    } else {
      res.locals.activeTheme = null;
      res.locals.themeAssets = { css: '', js: '', hasCss: false, hasJs: false };
    }
  } catch (err) {
    console.error('Theme middleware error:', err);
    res.locals.activeTheme = null;
    res.locals.themeAssets = { css: '', js: '', hasCss: false, hasJs: false };
  }
  next();
}

/**
 * Build the views path array for the given active theme.
 * Returns an array of view directories — theme views first, then default views.
 * @param {string|null} themeSlug - The active theme slug, or null
 * @param {string} defaultViewsPath - The default views directory
 * @returns {string[]} Array of view directory paths
 */
export function getThemeViewsPaths(themeSlug, defaultViewsPath) {
  if (!themeSlug || themeSlug === 'default') {
    return [defaultViewsPath];
  }

  const themeViewsPath = path.resolve(PROJECT_ROOT, 'themes', themeSlug, 'views');
  if (fs.existsSync(themeViewsPath)) {
    return [themeViewsPath, defaultViewsPath];
  }

  return [defaultViewsPath];
}

/**
 * Get the static assets serving config for the active theme.
 * @param {string|null} themeSlug - The active theme slug
 * @returns {Array} Array of [urlPath, folderPath] pairs for express.static
 */
export function getThemeStaticConfig(themeSlug) {
  if (!themeSlug || themeSlug === 'default') return [];

  const assetsPath = path.resolve(PROJECT_ROOT, 'themes', themeSlug, 'assets');
  if (fs.existsSync(assetsPath)) {
    return [['/assets/theme', assetsPath]];
  }

  return [];
}

/**
 * Rebuild the Express views array with the current active theme.
 * Called during server startup and after theme activation.
 * @param {object} app - Express app instance
 * @param {string} defaultViewsPath - Absolute path to the default views directory
 */
export async function rebuildThemeViews(app, defaultViewsPath) {
  try {
    const activeTheme = await Theme.getActive();
    const slug = activeTheme ? activeTheme.slug : null;
    const viewsPaths = getThemeViewsPaths(slug, defaultViewsPath);
    app.set('views', viewsPaths);
    console.log(`[Theme] Views paths: ${viewsPaths.join(' : ')}`);
  } catch (err) {
    console.error('[Theme] Error rebuilding views:', err);
    app.set('views', [defaultViewsPath]);
  }
}
