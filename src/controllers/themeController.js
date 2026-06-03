import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Theme from '../models/Theme.js';
import AuditLog from '../models/AuditLog.js';
import { generateSlug } from '../utils/slug.js';
import { rebuildThemeViews } from '../middleware/theme.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const DEFAULT_VIEWS = path.resolve(PROJECT_ROOT, 'src/views');

// ─── List Themes ────────────────────────────────────────────────────────────

export const getThemes = async (req, res) => {
  try {
    // Get themes from DB
    const dbThemes = await Theme.find({}).sort({ createdAt: -1 }).lean();

    // Scan themes directory for filesystem themes
    const dirThemes = Theme.scanDirectory();

    // Merge: DB data takes precedence, filesystem data fills gaps
    const themeMap = new Map();
    for (const t of dbThemes) {
      themeMap.set(t.slug, { ...t, source: 'db' });
    }
    for (const t of dirThemes) {
      if (themeMap.has(t.slug)) {
        // Merge manifest info if not in DB
        const existing = themeMap.get(t.slug);
        if (!existing.description && t.manifest.description)
          existing.description = t.manifest.description;
        if (!existing.author && t.manifest.author) existing.author = t.manifest.author;
        if (!existing.version && t.manifest.version) existing.version = t.manifest.version;
      } else {
        // Has a folder but no DB record — add as unregistered
        themeMap.set(t.slug, {
          slug: t.slug,
          name: t.manifest.name || t.slug,
          description: t.manifest.description || '',
          author: t.manifest.author || '',
          version: t.manifest.version || '1.0.0',
          isActive: false,
          customCss: '',
          customJs: '',
          source: 'filesystem',
          createdAt: null,
        });
      }
    }

    const themes = Array.from(themeMap.values());

    res.render('admin/themes/list', {
      title: 'Themes',
      themes,
    });
  } catch (error) {
    console.error('getThemes error:', error);
    res.status(500).render('admin/error', { title: 'Error', message: 'Failed to load themes.' });
  }
};

// ─── Create Theme ───────────────────────────────────────────────────────────

export const getCreateTheme = async (req, res) => {
  try {
    res.render('admin/themes/form', {
      title: 'Create Theme',
      theme: null,
    });
  } catch (error) {
    console.error('getCreateTheme error:', error);
    res.status(500).render('admin/error', { title: 'Error', message: 'Failed to load form.' });
  }
};

export const createTheme = async (req, res) => {
  try {
    const { name, description, author, version } = req.body;

    if (!name || !name.trim()) {
      return res.render('admin/themes/form', {
        title: 'Create Theme',
        theme: null,
        error: 'Theme name is required.',
      });
    }

    const slug = generateSlug(name);
    if (!slug) {
      return res.render('admin/themes/form', {
        title: 'Create Theme',
        theme: null,
        error: 'Could not generate a valid slug from the name.',
      });
    }

    // Check slug uniqueness
    const existing = await Theme.findOne({ slug });
    if (existing) {
      return res.render('admin/themes/form', {
        title: 'Create Theme',
        theme: null,
        error: `A theme with slug "${slug}" already exists.`,
      });
    }

    // Create theme folder structure
    const themesDir = Theme.getThemesDir();
    const themeDir = path.join(themesDir, slug);
    const viewsDir = path.join(themeDir, 'views/public');
    const cssDir = path.join(themeDir, 'assets/css');
    const jsDir = path.join(themeDir, 'assets/js');

    fs.mkdirSync(viewsDir, { recursive: true });
    fs.mkdirSync(cssDir, { recursive: true });
    fs.mkdirSync(jsDir, { recursive: true });

    // Create theme.json manifest
    const manifest = {
      name: name.trim(),
      description: (description || '').trim(),
      author: (author || '').trim(),
      version: (version || '1.0.0').trim(),
    };
    fs.writeFileSync(path.join(themeDir, 'theme.json'), JSON.stringify(manifest, null, 2), 'utf-8');

    // Create default CSS file
    fs.writeFileSync(
      path.join(cssDir, 'theme.css'),
      `/* ${name.trim()} — Theme Styles */\n`,
      'utf-8'
    );

    // Create default JS file
    fs.writeFileSync(path.join(jsDir, 'theme.js'), `// ${name.trim()} — Theme Scripts\n`, 'utf-8');

    // Create DB record
    const theme = await Theme.create({
      name: name.trim(),
      slug,
      description: (description || '').trim(),
      author: (author || '').trim(),
      version: (version || '1.0.0').trim(),
    });

    await AuditLog.log({
      action: 'create',
      entity: 'theme',
      entityId: theme._id,
      description: `Created theme "${theme.name}"`,
      req,
    });

    res.redirect('/admin/themes');
  } catch (error) {
    console.error('createTheme error:', error);
    res.status(500).render('admin/error', { title: 'Error', message: 'Failed to create theme.' });
  }
};

// ─── Edit Theme ─────────────────────────────────────────────────────────────

export const getEditTheme = async (req, res) => {
  try {
    const theme = await Theme.findById(req.params.id).lean();
    if (!theme) {
      return res.status(404).render('admin/error', { title: 'Error', message: 'Theme not found.' });
    }

    res.render('admin/themes/form', {
      title: `Edit Theme — ${theme.name}`,
      theme,
    });
  } catch (error) {
    console.error('getEditTheme error:', error);
    res.status(500).render('admin/error', { title: 'Error', message: 'Failed to load theme.' });
  }
};

export const updateTheme = async (req, res) => {
  try {
    const { name, description, author, version } = req.body;

    if (!name || !name.trim()) {
      return res.render('admin/themes/form', {
        title: 'Edit Theme',
        theme: { ...req.body, _id: req.params.id },
        error: 'Theme name is required.',
      });
    }

    const theme = await Theme.findById(req.params.id);
    if (!theme) {
      return res.status(404).render('admin/error', { title: 'Error', message: 'Theme not found.' });
    }

    const oldSlug = theme.slug;
    const newSlug = generateSlug(name);

    // Update DB record
    theme.name = name.trim();
    theme.slug = newSlug;
    theme.description = (description || '').trim();
    theme.author = (author || '').trim();
    theme.version = (version || '1.0.0').trim();
    await theme.save();

    // Update theme.json manifest
    const manifestPath = Theme.getManifestPath(oldSlug);
    if (fs.existsSync(manifestPath)) {
      const manifest = {
        name: name.trim(),
        description: (description || '').trim(),
        author: (author || '').trim(),
        version: (version || '1.0.0').trim(),
      };
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
    }

    // If slug changed, rename folder
    if (oldSlug !== newSlug) {
      const themesDir = Theme.getThemesDir();
      const oldPath = path.join(themesDir, oldSlug);
      const newPath = path.join(themesDir, newSlug);
      if (fs.existsSync(oldPath)) {
        fs.renameSync(oldPath, newPath);
      }
    }

    await AuditLog.log({
      action: 'update',
      entity: 'theme',
      entityId: theme._id,
      description: `Updated theme "${theme.name}"`,
      req,
    });

    res.redirect('/admin/themes');
  } catch (error) {
    console.error('updateTheme error:', error);
    res.status(500).render('admin/error', { title: 'Error', message: 'Failed to update theme.' });
  }
};

// ─── Activate Theme ─────────────────────────────────────────────────────────

export const activateTheme = async (req, res) => {
  try {
    const theme = await Theme.findById(req.params.id);
    if (!theme) {
      return res.status(404).render('admin/error', { title: 'Error', message: 'Theme not found.' });
    }

    await Theme.activate(theme.slug);

    // Rebuild Express views to use the new theme
    await rebuildThemeViews(req.app, DEFAULT_VIEWS);

    await AuditLog.log({
      action: 'update',
      entity: 'theme',
      entityId: theme._id,
      description: `Activated theme "${theme.name}"`,
      req,
    });

    // Also store in Settings for easy access
    const Setting = (await import('../models/Setting.js')).default;
    await Setting.setSetting('activeTheme', theme.slug);

    res.redirect('/admin/themes');
  } catch (error) {
    console.error('activateTheme error:', error);
    res.status(500).render('admin/error', { title: 'Error', message: 'Failed to activate theme.' });
  }
};

// ─── Delete Theme ───────────────────────────────────────────────────────────

export const deleteTheme = async (req, res) => {
  try {
    const theme = await Theme.findById(req.params.id);
    if (!theme) {
      return res.status(404).render('admin/error', { title: 'Error', message: 'Theme not found.' });
    }

    const wasActive = theme.isActive;
    const slug = theme.slug;

    // Remove DB record
    await Theme.findByIdAndDelete(req.params.id);

    // Remove theme folder
    const themeDir = path.join(Theme.getThemesDir(), slug);
    if (fs.existsSync(themeDir)) {
      fs.rmSync(themeDir, { recursive: true, force: true });
    }

    // If it was active, reset views
    if (wasActive) {
      await rebuildThemeViews(req.app, DEFAULT_VIEWS);
      const Setting = (await import('../models/Setting.js')).default;
      await Setting.setSetting('activeTheme', 'default');
    }

    await AuditLog.log({
      action: 'delete',
      entity: 'theme',
      entityId: theme._id,
      description: `Deleted theme "${theme.name}"`,
      req,
    });

    res.redirect('/admin/themes');
  } catch (error) {
    console.error('deleteTheme error:', error);
    res.status(500).render('admin/error', { title: 'Error', message: 'Failed to delete theme.' });
  }
};

// ─── Customize Theme ────────────────────────────────────────────────────────

export const getCustomizeTheme = async (req, res) => {
  try {
    const theme = await Theme.findById(req.params.id).lean();
    if (!theme) {
      return res.status(404).render('admin/error', { title: 'Error', message: 'Theme not found.' });
    }

    // Read current CSS/JS from filesystem as fallback
    let cssContent = theme.customCss || '';
    let jsContent = theme.customJs || '';

    const cssPath = path.join(Theme.getThemesDir(), theme.slug, 'assets/css/theme.css');
    const jsPath = path.join(Theme.getThemesDir(), theme.slug, 'assets/js/theme.js');

    if (!cssContent && fs.existsSync(cssPath)) {
      cssContent = fs.readFileSync(cssPath, 'utf-8');
    }
    if (!jsContent && fs.existsSync(jsPath)) {
      jsContent = fs.readFileSync(jsPath, 'utf-8');
    }

    // List overridden templates
    const viewsDir = path.join(Theme.getThemesDir(), theme.slug, 'views/public');
    const overriddenTemplates = [];
    if (fs.existsSync(viewsDir)) {
      const walkDir = (dir, prefix) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walkDir(fullPath, `${prefix}${entry.name}/`);
          } else if (entry.name.endsWith('.ejs')) {
            overriddenTemplates.push(`${prefix}${entry.name.replace('.ejs', '')}`);
          }
        }
      };
      walkDir(viewsDir, '');
    }

    res.render('admin/themes/customize', {
      title: `Customize — ${theme.name}`,
      theme,
      cssContent,
      jsContent,
      overriddenTemplates,
    });
  } catch (error) {
    console.error('getCustomizeTheme error:', error);
    res
      .status(500)
      .render('admin/error', { title: 'Error', message: 'Failed to load customize page.' });
  }
};

export const updateCustomizeTheme = async (req, res) => {
  try {
    const { customCss, customJs } = req.body;

    const theme = await Theme.findById(req.params.id);
    if (!theme) {
      return res.status(404).render('admin/error', { title: 'Error', message: 'Theme not found.' });
    }

    // Save to DB
    theme.customCss = customCss || '';
    theme.customJs = customJs || '';
    await theme.save();

    // Also write to filesystem
    const cssPath = path.join(Theme.getThemesDir(), theme.slug, 'assets/css/theme.css');
    const jsPath = path.join(Theme.getThemesDir(), theme.slug, 'assets/js/theme.js');
    fs.writeFileSync(cssPath, customCss || '', 'utf-8');
    fs.writeFileSync(jsPath, customJs || '', 'utf-8');

    await AuditLog.log({
      action: 'update',
      entity: 'theme',
      entityId: theme._id,
      description: `Customized theme "${theme.name}" (CSS/JS)`,
      req,
    });

    res.redirect(`/admin/themes/${req.params.id}/customize`);
  } catch (error) {
    console.error('updateCustomizeTheme error:', error);
    res
      .status(500)
      .render('admin/error', { title: 'Error', message: 'Failed to update customization.' });
  }
};
