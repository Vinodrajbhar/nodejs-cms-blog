# Blog CMS — Developer Documentation

Comprehensive guide for developers working on, extending, or integrating with this CMS.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Stack & Dependencies](#stack--dependencies)
- [Database Models](#database-models)
- [Routes & URL Resolution](#routes--url-resolution)
- [Controllers](#controllers)
- [Middleware](#middleware)
- [View System](#view-system)
- [Theme System](#theme-system)
- [SEO System](#seo-system)
- [Permalink System](#permalink-system)
- [Security Features](#security-features)
- [API Reference](#api-reference)
- [Extending the CMS](#extending-the-cms)

---

## Architecture Overview

```
┌─────────────┐     ┌──────────────┐     ┌──────────┐
│  Browser     │────▶│  Express.js  │────▶│  MongoDB  │
│  (Visitor)   │     │  (Server)    │     │          │
└─────────────┘     │              │     └──────────┘
                    │  ┌──────────┐│
┌─────────────┐     │  │  EJS     ││
│  Browser     │────▶│  │  Views   ││
│  (Admin)     │     │  └──────────┘│
└─────────────┘     └──────────────┘
```

The CMS follows a classic **MVC** pattern:

- **Models** — Mongoose schemas in `src/models/`
- **Views** — EJS templates in `src/views/` + theme overrides
- **Controllers** — Route handlers in `src/controllers/`
- **Middleware** — Request processing pipeline in `src/middleware/`

### Request Lifecycle

```
Request
  ├── compression (gzip)
  ├── helmet (security headers)
  ├── express.static (serve static files)
  ├── urlencoded + json body parsers
  ├── session (express-session + MongoStore)
  ├── setLocals (currentUser in all views)
  ├── injectThemeData (active theme info)
  ├── csrfProtection (/admin only)
  ├── strictRateLimiter (/admin/login only)
  ├── Route handler (controller)
  ├── View rendering (EJS)
  └── Response
```

---

## Project Structure

```
nodejs-expressjs/
├── src/server.js                     # App entry point
├── package.json
├── eslint.config.js
├── .env                              # Environment variables
├── INSTALLATION.md                   # Setup guide
├── DEVELOPER.md                      # This file
│
├── src/
│   ├── config/
│   │   ├── db.js                     # MongoDB connection
│   │   └── session.js                # Session configuration
│   │
│   ├── models/                       # Mongoose schemas
│   │   ├── User.js
│   │   ├── Post.js
│   │   ├── Page.js
│   │   ├── Category.js
│   │   ├── Tag.js
│   │   ├── Comment.js
│   │   ├── Media.js
│   │   ├── Setting.js                # Key-value store
│   │   ├── Theme.js
│   │   └── AuditLog.js
│   │
│   ├── controllers/
│   │   ├── publicController.js       # Public-facing pages
│   │   ├── adminController.js        # Admin CRUD operations
│   │   ├── authController.js         # Login/logout
│   │   └── themeController.js        # Theme management
│   │
│   ├── middleware/
│   │   ├── auth.js                   # requireAuth, requireRole, setLocals
│   │   ├── security.js               # CSRF, rate limiting
│   │   ├── theme.js                  # Theme injection, view rebuilding
│   │   ├── permalink.js              # URL routing via permalink structure
│   │   └── upload.js                 # File upload handling
│   │
│   ├── routes/
│   │   ├── index.js                  # Public routes (GET /, /search, /robots.txt, etc.)
│   │   ├── admin.js                  # Admin panel routes
│   │   ├── auth.js                   # Login/logout routes
│   │   └── api.js                    # API endpoints (comments)
│   │
│   ├── utils/
│   │   ├── slug.js                   # URL slug generation
│   │   └── permalink.js              # Permalink structure parsing & generation
│   │
│   ├── database/
│   │   └── seeds/
│   │       └── seed.js               # Database seeder
│   │
│   └── views/                        # Default view templates
│       ├── layouts/
│       │   ├── public_header.ejs     # Public header (SEO meta, nav)
│       │   ├── public_footer.ejs     # Public footer
│       │   ├── public.ejs            # Public wrapper layout
│       │   ├── admin_header.ejs      # Admin sidebar + header
│       │   ├── admin_footer.ejs      # Admin footer
│       │   └── admin.ejs             # Admin wrapper layout
│       ├── public/
│       │   ├── index.ejs             # Homepage (post list)
│       │   ├── post.ejs              # Single post
│       │   ├── page.ejs              # Single page
│       │   ├── search.ejs            # Search results
│       │   ├── error.ejs             # 404/error page
│       │   └── partials/
│       │       └── sidebar.ejs       # Categories + tags sidebar
│       └── admin/
│           ├── dashboard.ejs
│           ├── login.ejs
│           ├── error.ejs
│           ├── posts/{form,list}.ejs
│           ├── pages/{form,list}.ejs
│           ├── categories/list.ejs
│           ├── tags/list.ejs
│           ├── comments/list.ejs
│           ├── media/index.ejs
│           ├── navigation/index.ejs
│           ├── themes/{list,form,customize}.ejs
│           ├── settings/index.ejs
│           ├── users/list.ejs
│           └── audit-logs/index.ejs
│
├── themes/                           # Theme system
│   ├── default/                      # Built-in default theme
│   │   ├── theme.json
│   │   └── assets/{css,js}/
│   └── ocean-blue/                   # Ocean Blue theme (example)
│       ├── theme.json
│       ├── assets/{css,js}/
│       └── views/public/
│           └── index.ejs             # Theme overrides
│
├── public/                           # Static assets
│   ├── css/
│   ├── js/
│   └── uploads/                      # Image uploads
│
└── static/                           # Additional static files
```

---

## Stack & Dependencies

### Runtime

| Package           | Version | Purpose                       |
| ----------------- | ------- | ----------------------------- |
| `express`         | ^5.2.1  | Web framework                 |
| `mongoose`        | ^9.6.3  | MongoDB ODM                   |
| `ejs`             | ^6.0.1  | Template engine               |
| `bcryptjs`        | ^3.0.3  | Password hashing              |
| `express-session` | ^1.19.0 | Session management            |
| `connect-mongo`   | ^6.0.0  | MongoDB session store         |
| `helmet`          | ^8.2.0  | Security HTTP headers         |
| `compression`     | ^1.8.1  | Gzip response compression     |
| `multer`          | ^2.1.1  | File upload handling          |
| `sharp`           | ^0.34.5 | Image processing (thumbnails) |
| `dotenv`          | ^17.4.2 | Environment variable loading  |

### Dev

| Package                  | Purpose                       |
| ------------------------ | ----------------------------- |
| `nodemon`                | Auto-restart on file changes  |
| `eslint`                 | Code linting                  |
| `prettier`               | Code formatting               |
| `eslint-config-prettier` | ESLint + Prettier integration |

---

## Database Models

### 1. User

| Field    | Type   | Notes                               |
| -------- | ------ | ----------------------------------- |
| username | String | Unique, min 3 chars                 |
| email    | String | Unique, lowercase                   |
| password | String | Min 6 chars, auto-hashed via bcrypt |
| role     | Enum   | `admin`, `editor`, or `author`      |

**Methods:** `comparePassword(password)`, `toJSON()` (excludes password)

### 2. Post

| Field                             | Type       | Notes                             |
| --------------------------------- | ---------- | --------------------------------- |
| title                             | String     | Required, trimmed                 |
| slug                              | String     | Unique, lowercase                 |
| content                           | String     | HTML content                      |
| excerpt                           | String     | Max 500 chars                     |
| featuredImage                     | String     | URL path                          |
| author                            | ObjectId   | Ref → User                        |
| categories                        | [ObjectId] | Ref → Category[]                  |
| tags                              | [ObjectId] | Ref → Tag[]                       |
| status                            | Enum       | `draft`, `published`, `scheduled` |
| publishedAt                       | Date       |                                   |
| scheduledAt                       | Date       |                                   |
| seoTitle                          | String     |                                   |
| metaDescription                   | String     | Max 160 chars                     |
| focusKeyphrase                    | String     |                                   |
| ogImage / ogTitle / ogDescription | String     | Open Graph                        |
| canonicalUrl                      | String     |                                   |
| noindex                           | Boolean    |                                   |
| breadcrumbTitle                   | String     |                                   |

### 3. Page

Same SEO fields as Post. No categories or tags. Status: `draft` or `published`.

### 4. Category

| Field                                          | Type   | Notes              |
| ---------------------------------------------- | ------ | ------------------ |
| name                                           | String | Required           |
| slug                                           | String | Unique             |
| description                                    | String |                    |
| postCount                                      | Number | Denormalized count |
| seoTitle / metaDescription / noindex / ogImage |        | SEO fields         |

### 5. Tag

| Field                                | Type   | Notes              |
| ------------------------------------ | ------ | ------------------ |
| name                                 | String | Required           |
| slug                                 | String | Unique             |
| postCount                            | Number | Denormalized count |
| seoTitle / metaDescription / noindex |        | SEO fields         |

### 6. Comment

| Field   | Type     | Notes                         |
| ------- | -------- | ----------------------------- |
| post    | ObjectId | Ref → Post                    |
| author  | Embedded | `{ name, email, website }`    |
| content | String   |                               |
| status  | Enum     | `pending`, `approved`, `spam` |

### 7. Media

| Field                           | Type     | Notes           |
| ------------------------------- | -------- | --------------- |
| originalName                    | String   |                 |
| filename                        | String   | Server filename |
| path                            | String   | File path       |
| thumbnailPath                   | String   | 300x200 JPEG    |
| mimeType                        | String   |                 |
| size                            | Number   | Bytes           |
| uploadedBy                      | ObjectId | Ref → User      |
| altText / caption / description | String   | SEO fields      |

### 8. Setting (Key-Value Store)

| Field | Type   | Notes                 |
| ----- | ------ | --------------------- |
| key   | String | Unique                |
| value | Mixed  | Any JSON-serializable |

**Static Methods:**

- `Setting.getSettings()` — Returns all settings as `{ key: value }` object
- `Setting.getSetting(key, default)` — Get a single setting with fallback
- `Setting.setSetting(key, value)` — Upsert a setting

### 9. Theme

| Field       | Type    | Notes                           |
| ----------- | ------- | ------------------------------- |
| name        | String  |                                 |
| slug        | String  | Unique, lowercase               |
| description | String  |                                 |
| author      | String  |                                 |
| version     | String  | Default `1.0.0`                 |
| isActive    | Boolean | Only one theme active at a time |
| customCss   | String  | Custom CSS entered via admin    |
| customJs    | String  | Custom JS entered via admin     |

**Key Static Methods:**

- `Theme.getActive()` — Returns active theme document
- `Theme.activate(slug)` — Deactivates all, activates one
- `Theme.scanDirectory()` — Scans `themes/` folder for theme manifests
- `Theme.getViewsDir(slug)` — Returns path to theme's views directory
- `Theme.getAssetsDir(slug)` — Returns path to theme's assets directory

### 10. AuditLog

| Field         | Type     | Notes                                                                             |
| ------------- | -------- | --------------------------------------------------------------------------------- |
| action        | Enum     | `create`, `update`, `delete`, `login`, `logout`, `upload`, `approve`, `spam`      |
| entity        | Enum     | `post`, `page`, `category`, `tag`, `media`, `comment`, `user`, `setting`, `theme` |
| entityId      | ObjectId |                                                                                   |
| description   | String   |                                                                                   |
| performedBy   | ObjectId | Ref → User                                                                        |
| performerName | String   | Denormalized username                                                             |
| ip            | String   |                                                                                   |
| metadata      | Mixed    | Extra data                                                                        |

**Static Method:** `AuditLog.log({ action, entity, entityId, description, req, metadata })` — Creates an audit entry with IP and user info automatically extracted from the request.

---

## Routes & URL Resolution

### Public Routes (`src/routes/index.js`)

| Method | Path           | Handler             | Description             |
| ------ | -------------- | ------------------- | ----------------------- |
| GET    | `/`            | `getHome`           | Homepage (paginated)    |
| GET    | `/search`      | `search`            | Search results          |
| GET    | `/robots.txt`  | Inline              | Dynamic robots.txt      |
| GET    | `/feed.xml`    | Inline              | RSS feed (20 posts)     |
| GET    | `/sitemap.xml` | Inline              | XML sitemap             |
| GET    | `/:params*`    | `permalinkCatchAll` | Permalink-based routing |

The permalink catch-all router (`src/middleware/permalink.js`) resolves URLs based on the configured permalink structure. It dynamically builds regex patterns from structure tags and matches against the request path to determine whether it's a post, page, category, or tag.

### Permalink Routing Priority

The `permalinkCatchAll` middleware handles URL resolution in this order:

1. **Static pages** — `/about`, `/contact`, etc. (Page model)
2. **Posts** — Matched against the permalink structure pattern
3. **Categories** — `/category/{slug}/`
4. **Tags** — `/tag/{slug}/`
5. **404** — If nothing matches

### Admin Routes (`src/routes/admin.js`)

All admin routes are prefixed with `/admin` and require authentication.

| Area       | Path Pattern                           | Auth Required |
| ---------- | -------------------------------------- | ------------- |
| Dashboard  | `/`                                    | `requireAuth` |
| Posts      | `/posts`, `/posts/new`, `/posts/:id/*` | `requireAuth` |
| Pages      | `/pages`, `/pages/new`, `/pages/:id/*` | `requireAuth` |
| Categories | `/categories`, `/categories/:id/*`     | `requireAuth` |
| Tags       | `/tags`, `/tags/:id/*`                 | `requireAuth` |
| Comments   | `/comments`, `/comments/:id/*`         | `requireAuth` |
| Media      | `/media`, `/media/*`                   | `requireAuth` |
| Navigation | `/navigation`                          | Admin only    |
| Themes     | `/themes`, `/themes/:id/*`             | Admin only    |
| Settings   | `/settings`                            | Admin only    |
| Users      | `/users`, `/users/:id/*`               | Admin only    |
| Audit Logs | `/audit-logs`                          | Admin only    |

### API Routes (`src/routes/api.js`)

| Method | Path            | Description                     |
| ------ | --------------- | ------------------------------- |
| POST   | `/api/comments` | Submit a comment (JSON or form) |

The comments endpoint supports both AJAX (returns JSON) and regular form POST (redirects back).

---

## Controllers

### publicController.js

**Key Functions:**

| Function                       | Description                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| `getSiteData()`                | Fetches site-wide data (settings, categories, tags, pages). Used by all public views. |
| `seoMeta(siteData, overrides)` | Generates SEO meta object (title, OG, Twitter, schema).                               |
| `publishedFilter()`            | Returns MongoDB filter for published/scheduled posts                                  |
| `getHome()`                    | Renders homepage with paginated posts                                                 |
| `getPost()`                    | Renders single post with comments                                                     |
| `getPage()`                    | Renders single page                                                                   |
| `getCategory()`                | Renders paginated posts filtered by category                                          |
| `getTag()`                     | Renders paginated posts filtered by tag                                               |
| `search()`                     | Full-text search on title, content, excerpt                                           |

**Pattern: `getSiteData()`** returns:

```js
{
  siteName, categories, tags, pages,
  siteTagline, titleSeparator, siteUrl,
  homepageSeoTitle, homepageMetaDescription, homepageOgImage,
  twitterUsername, facebookUrl, noindexSite,
  navItems, navAutoPages,
  permalinkStructure, categoryBase, tagBase,
  postUrl: (post) => generatePostUrl(post, structure),
  categoryUrl: (cat) => generateCategoryUrl(cat, categoryBase),
  tagUrl: (tag) => generateTagUrl(tag, tagBase),
  pageUrl: (page) => generatePageUrl(page),
}
```

**Pattern: `seoMeta()`** output includes:

```js
{
  (pageSeoTitle,
    pageMetaDescription,
    pageOgTitle,
    pageOgDescription,
    pageOgImage,
    pageCanonical,
    pageNoindex,
    ogType,
    twitterCardType,
    pageSchema,
    searchUrl,
    siteUrl,
    twitterUsername);
}
```

### adminController.js

Full CRUD for all content entities. Common patterns:

- **Pagination:** `page = parseInt(req.query.page) || 1; skip = (page - 1) * limit`
- **Slug generation:** `generateSlug(title)` with uniqueness counter
- **Denormalized counts:** `Category.updateMany({ _id: ids }, { $inc: { postCount: ±1 } })`
- **Audit logging:** Every create/update/delete calls `AuditLog.log()`
- **Error handling:** Try/catch with `res.render('admin/error', { title, message })`

### authController.js

- `getLogin` — Renders login form
- `postLogin` — Validates credentials, creates session, redirects
- `logout` — Destroys session, regenerates to prevent fixation

### themeController.js

- CRUD for themes (DB record + filesystem folder creation/deletion)
- Theme activation (deactivates all, activates one, rebuilds Express views)
- Custom CSS/JS saving

---

## Middleware

### auth.js

| Middleware         | Description                                               |
| ------------------ | --------------------------------------------------------- |
| `requireAuth`      | Redirects to `/admin/login` if no session                 |
| `requireRole(...)` | Returns 403 if user role not in the allowed list          |
| `setLocals`        | Exposes `currentUser` (`{ id, username, role }`) to views |

### security.js

| Middleware                   | Description                                                                  |
| ---------------------------- | ---------------------------------------------------------------------------- |
| `csrfProtection`             | Generates CSRF token, validates on mutating methods, refreshes after success |
| `rateLimiter(windowMs, max)` | In-memory rate limiter with `X-RateLimit-*` headers                          |
| `strictRateLimiter`          | Pre-configured strict limiter for `/admin/login`                             |

**CSRF token flow:**

1. Token generated on first visit, stored in `req.session.csrfToken`
2. Exposed to views via `res.locals.csrfToken`
3. POST/PUT/PATCH/DELETE requests validated against `req.body._csrf` or `X-CSRF-Token` header
4. Token refreshed after each successful mutation

### theme.js

| Middleware / Function                        | Description                                          |
| -------------------------------------------- | ---------------------------------------------------- |
| `injectThemeData`                            | Injects `activeTheme` + `themeAssets` into all views |
| `rebuildThemeViews(app, defaultViewsPath)`   | Rebuilds Express `views` array from active theme     |
| `getThemeViewsPaths(slug, defaultViewsPath)` | Returns `[themeViews, defaultViews]`                 |

### permalink.js

Handles dynamic URL routing based on the configured permalink structure.

- Builds regex patterns from structure tags (e.g., `/%year%/%monthnum%/%postname%/`)
- Routes to appropriate handler: post, page, category, or tag
- Supports old permalink structure redirects (for backward compatibility when structure changes)

### upload.js

- Uses **multer** for file handling
- **File filter:** Images only (JPEG, PNG, GIF, WebP, SVG)
- **Size limit:** 5MB
- **Storage:** `public/uploads/` with `timestamp-random.ext` naming
- **Security:** Validates file content via magic bytes (signature verification)
- **Thumbnails:** Sharp generates 300x200 JPEG thumbnails at 80% quality

---

## View System

### Layout Hierarchy

```
public_header.ejs  ────┐
                        │
            public/index.ejs  (or other content view)
                        │
public_footer.ejs   ────┘
```

The public header (`public_header.ejs`) includes:

- Dynamic `<title>` tag (SEO-aware with separator)
- Meta description, canonical URL, robots
- Open Graph tags (og:title, og:description, og:image)
- Twitter Card tags
- JSON-LD structured data (WebSite schema + page-specific schema)
- Navigation menu (site pages + custom nav items)
- Theme CSS/JS injection

The admin layout (`admin.ejs`) includes:

- Collapsible sidebar with icon navigation
- Dark mode support
- Current user display
- Bootstrap Icons

### Available View Locals

**All views (from `setLocals`):**

- `currentUser` — `{ id, username, role }` or `null`
- `path` — Current request path

**Public views (from `getSiteData`):**

- `siteName`, `categories`, `tags`, `pages`
- `siteTagline`, `titleSeparator`, `siteUrl`
- `navItems`, `navAutoPages`
- `postUrl(post)`, `categoryUrl(cat)`, `tagUrl(tag)`, `pageUrl(page)`
- `permalinkStructure`, `categoryBase`, `tagBase`

**SEO locals (from `seoMeta`):**

- `pageSeoTitle`, `pageMetaDescription`
- `pageOgTitle`, `pageOgDescription`, `pageOgImage`
- `pageCanonical`, `pageNoindex`
- `ogType`, `twitterCardType`
- `pageSchema` (JSON-LD script)
- `searchUrl`, `twitterUsername`

**Theme locals (from `injectThemeData`):**

- `activeTheme` — Active theme document
- `themeAssets` — `{ css, js, hasCss, hasJs }`

### Template Rendering Best Practices

- Use `<%= %>` for escaped output (safe, default)
- Use `<%- %>` for unescaped output (only for trusted HTML like post content)
- Strip HTML tags with `.replace(/<[^>]*>/g, '')` when displaying excerpts or content snippets
- Use `include()` for partials and layouts

---

## Theme System

### How It Works

1. **Theme folders** live under `themes/{slug}/` with a `theme.json` manifest
2. **DB records** store metadata (name, author, version, active status, custom CSS/JS)
3. **Template resolution** — Express `views` array is set to `[themeViews, defaultViews]`. Theme views take priority; if a template isn't found in the theme, it falls back to `src/views/`
4. **Assets** are served statically under `/assets/theme/` via dynamic middleware

### Creating a Theme

Create a folder in `themes/` with this structure:

```
themes/my-theme/
├── theme.json
├── assets/
│   ├── css/
│   │   └── theme.css
│   └── js/
│       └── theme.js
└── views/
    └── public/
        ├── index.ejs       # Override homepage
        ├── post.ejs        # Override single post
        ├── page.ejs        # Override single page
        ├── search.ejs      # Override search results
        ├── error.ejs       # Override 404/error
        └── partials/
            └── sidebar.ejs # Override sidebar
```

**`theme.json` format:**

```json
{
  "name": "My Theme",
  "description": "Description of the theme",
  "author": "Your Name",
  "version": "1.0.0"
}
```

### Theme Override Rules

- Place `.ejs` files in `themes/{slug}/views/public/` matching the template name used in `res.render()`
- You can override **any** public view template
- The `layouts/` directory is **not** overridable from themes (shared across themes)
- Custom CSS/JS can be added via the admin "Customize" panel (stored in DB, injected into `<head>` and before `</body>`)

### Activating a Theme

From the admin panel at `/admin/themes`, click "Activate" on any theme. This:

1. Deactivates all other themes in the DB
2. Sets the active theme
3. Rebuilds the Express `views` array to include the theme's view directory

### Theme Static Assets

- Theme assets are served at `/assets/theme/css/theme.css` and `/assets/theme/js/theme.js`
- The `injectThemeData` middleware checks if the files actually exist and sets `themeAssets.hasCss` / `themeAssets.hasJs`
- The `public_header.ejs` conditionally links theme CSS only if it exists

---

## SEO System

The CMS includes a comprehensive SEO framework inspired by WordPress SEO plugins.

### Per-Entity SEO Fields

The following entities have dedicated SEO fields:

| Entity   | Fields                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------ |
| Post     | seoTitle, metaDescription, focusKeyphrase, ogImage, ogTitle, ogDescription, canonicalUrl, noindex, breadcrumbTitle |
| Page     | Same as Post                                                                                                       |
| Category | seoTitle, metaDescription, noindex, ogImage                                                                        |
| Tag      | seoTitle, metaDescription, noindex                                                                                 |

### Global SEO Settings

Configured in Admin → Settings:

- Homepage SEO title & meta description
- Default OG image (fallback for all pages)
- Site-wide noindex toggle
- Title separator character
- Twitter username (for Twitter Cards)

### SEO Meta Generation

The `seoMeta()` helper in `publicController.js` generates all SEO output:

```js
const meta = seoMeta(siteData, {
  seoTitle: post.seoTitle || post.title,
  metaDescription: post.metaDescription || post.excerpt || post.title,
  ogImage: post.ogImage || post.featuredImage || siteData.homepageOgImage,
  canonicalUrl: post.canonicalUrl || undefined,
  noindex: post.noindex || false,
  ogType: 'article',
  twitterCard: 'summary_large_image',
  schema: '<script type="application/ld+json">...</script>',
  path: '/post/' + post.slug,
});
```

### Structured Data (JSON-LD)

- **Homepage:** WebSite schema with SearchAction (Sitelinks Search Box)
- **Posts:** Article schema with headline, description, image, datePublished, dateModified, author
- Each page can pass custom schema via the `schema` override in `seoMeta()`

### Dynamic robots.txt

Generated based on the `noindexSite` setting. When enabled, produces:

```
User-agent: *
Disallow: /
```

Otherwise:

```
User-agent: *
Allow: /
Disallow: /admin
Disallow: /api
```

### Sitemap

Auto-generated XML sitemap at `/sitemap.xml` includes:

- All published posts (with lastmod dates)
- All published pages
- All categories
- All tags

---

## Permalink System

The permalink system provides WordPress-compatible URL structures.

### Structure Tags

| Tag          | Regex Pattern                   |
| ------------ | ------------------------------- |
| `%postname%` | `(?<postname>[^/]+)`            |
| `%post_id%`  | `(?<post_id>\d+)`               |
| `%year%`     | `(?<year>\d{4})`                |
| `%monthnum%` | `(?<monthnum>0[1-9]\|1[0-2])`   |
| `%day%`      | `(?<day>0[1-9]\|[12]\d\|3[01])` |
| `%category%` | `(?<category>[^/]+)`            |
| `%author%`   | `(?<author>[^/]+)`              |

### Preset Structures

| Preset     | Pattern                                |
| ---------- | -------------------------------------- |
| default    | `/post/%postname%/`                    |
| postname   | `/%postname%/`                         |
| day_name   | `/%year%/%monthnum%/%day%/%postname%/` |
| month_name | `/%year%/%monthnum%/%postname%/`       |
| numeric    | `/archives/%post_id%/`                 |

### URL Generation Functions

Included in `getSiteData()` response and available to all views:

- `postUrl(post)` — Generates URL based on current permalink structure
- `categoryUrl(cat)` — Generates `/category/{slug}/`
- `tagUrl(tag)` — Generates `/tag/{slug}/`
- `pageUrl(page)` — Generates `/page/{slug}`

### Old Structure Redirects

When the permalink structure changes, the system saves the old structure and creates redirect matchers so old URLs continue to work (301 redirect).

---

## Security Features

| Feature               | Implementation                                       |
| --------------------- | ---------------------------------------------------- |
| Password hashing      | bcrypt with salt rounds = 12                         |
| Session security      | httpOnly cookies, secure in production, sameSite=lax |
| Session fixation      | `session.regenerate()` on login                      |
| CSRF protection       | Token in session, validated on mutating methods      |
| Rate limiting         | In-memory store, configurable window/max             |
| File upload security  | Magic bytes validation + MIME type check             |
| HTTP security headers | Helmet with custom CSP                               |
| XSS prevention        | EJS auto-escapes output (`<%= %>`)                   |
| SQL injection         | N/A (Mongoose + prepared statements)                 |
| Role-based access     | `requireAuth` + `requireRole(...)` middleware        |

### Content Security Policy (CSP)

The CSP allows:

- `'self'` for all content
- `cdn.tailwindcss.com` (Tailwind CDN)
- `cdn.jsdelivr.net` (Bootstrap Icons)
- `code.jquery.com` (jQuery)
- `fonts.googleapis.com` / `fonts.gstatic.com` (Google Fonts)
- `'unsafe-inline'` for scripts and styles

---

## API Reference

### Public API

#### `POST /api/comments`

Submit a comment on a post.

**Request body (JSON):**

```json
{
  "postId": "60f7...",
  "name": "John Doe",
  "email": "john@example.com",
  "website": "https://example.com",
  "content": "Great article!"
}
```

**Response (AJAX):**

```json
{
  "message": "Comment submitted for moderation.",
  "comment": { ... }
}
```

**Response (form POST):** Redirects back to the post.

### Internal API

#### `GET /health`

Health check endpoint (no auth required).

**Response:**

```json
{
  "status": "ok",
  "uptime": 123.45,
  "timestamp": "2026-06-03T06:00:00.000Z",
  "database": "connected",
  "memory": { "rss": 123456, ... },
  "env": "development"
}
```

#### `GET /admin/api/media`

Returns all media items as JSON (auth required).

---

## Extending the CMS

### Adding a New Model

1. Create a Mongoose schema in `src/models/`
2. Add CRUD methods in a controller
3. Add routes in the appropriate route file
4. Create EJS views
5. Add audit logging support if needed

### Adding a New Public Page Type

1. Add the route in `src/routes/index.js`
2. Add the handler in `src/controllers/publicController.js`
3. Add the view template in `src/views/public/`
4. Update the permalink router in `src/middleware/permalink.js` if it needs URL resolution

### Adding a New Admin Section

1. Add the route in `src/routes/admin.js` (with appropriate auth middleware)
2. Add controller methods in `src/controllers/adminController.js`
3. Add view templates in `src/views/admin/`
4. Add a sidebar link in `src/views/layouts/admin_header.ejs`

### Adding a Custom Setting

Add it to the settings form in `src/views/admin/settings/index.ejs` and it will be automatically handled by the existing `updateSettings` controller (which saves all form fields as key-value pairs via `Setting.setSetting()`).

### Creating a New Theme

See the [Theme System](#theme-system) section above. The quickest way:

1. Create `themes/my-theme/theme.json` with name, description, author
2. Add `views/public/index.ejs` to override the homepage
3. Activate from Admin → Themes

### Contributing Code

- Follow the existing patterns (error handling, audit logging, pagination)
- Use ES modules (`import`/`export`)
- Keep controllers lean; put reusable logic in models or utils
- Add audit logging for all CRUD operations
- Handle both JSON and HTML responses for API-like endpoints
