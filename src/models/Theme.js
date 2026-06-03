import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const themeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      default: '',
    },
    author: {
      type: String,
      default: '',
    },
    version: {
      type: String,
      default: '1.0.0',
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    customCss: {
      type: String,
      default: '',
    },
    customJs: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

const Theme = mongoose.model('Theme', themeSchema);

/**
 * Get the currently active theme document.
 * @returns {Object|null} Active theme document (lean), or null if none active
 */
Theme.getActive = async function () {
  return await this.findOne({ isActive: true }).lean();
};

/**
 * Activate a theme by slug, deactivating all others.
 * @param {string} slug - Theme slug to activate
 * @returns {Object} Activated theme document
 */
Theme.activate = async function (slug) {
  // Deactivate all themes
  await this.updateMany({}, { isActive: false });
  // Activate the requested one
  const theme = await this.findOneAndUpdate(
    { slug },
    { isActive: true },
    { returnDocument: 'after' }
  );
  return theme;
};

/**
 * Get the themes directory path (project root / themes).
 * @returns {string} Absolute path to themes directory
 */
Theme.getThemesDir = function () {
  return path.resolve(__dirname, '../../themes');
};

/**
 * Get the views directory path for a theme.
 * @param {string} slug - Theme slug
 * @returns {string} Absolute path to theme's views directory
 */
Theme.getViewsDir = function (slug) {
  return path.resolve(Theme.getThemesDir(), slug, 'views');
};

/**
 * Get the assets directory path for a theme.
 * @param {string} slug - Theme slug
 * @returns {string} Absolute path to theme's assets directory
 */
Theme.getAssetsDir = function (slug) {
  return path.resolve(Theme.getThemesDir(), slug, 'assets');
};

/**
 * Get the theme.json path for a theme.
 * @param {string} slug - Theme slug
 * @returns {string} Absolute path to theme.json
 */
Theme.getManifestPath = function (slug) {
  return path.resolve(Theme.getThemesDir(), slug, 'theme.json');
};

/**
 * Scan the themes directory for installed themes (folders with theme.json).
 * Returns an array of { slug, manifest } objects.
 */
Theme.scanDirectory = function () {
  const themesDir = Theme.getThemesDir();
  if (!fs.existsSync(themesDir)) return [];

  const entries = fs.readdirSync(themesDir, { withFileTypes: true });
  const themes = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(themesDir, entry.name, 'theme.json');
    if (fs.existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        themes.push({ slug: entry.name, manifest });
      } catch {
        // Invalid JSON — skip
      }
    }
  }

  return themes;
};

/**
 * Check if a theme's views directory contains a specific view file.
 * @param {string} slug - Theme slug
 * @param {string} viewPath - Relative view path (e.g., 'public/index')
 * @returns {boolean}
 */
Theme.viewExists = function (slug, viewPath) {
  const fullPath = path.resolve(Theme.getViewsDir(slug), `${viewPath}.ejs`);
  return fs.existsSync(fullPath);
};

export default Theme;
