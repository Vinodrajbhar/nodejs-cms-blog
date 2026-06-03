# 📝 Blog CMS

> A full-featured, self-hosted blog content management system built with **Express.js 5**, **MongoDB**, and **EJS** — featuring a theme system, WordPress-compatible permalinks, SEO tools, and role-based administration.

<p align="center">
  <img src="https://img.shields.io/badge/Express.js-5.x-000000?logo=express" alt="Express.js 5">
  <img src="https://img.shields.io/badge/MongoDB-9.x-47A248?logo=mongodb" alt="MongoDB">
  <img src="https://img.shields.io/badge/EJS-6.x-B4CA65?logo=ejs" alt="EJS">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License">
  <img src="https://img.shields.io/github/stars/Vinodrajbhar/nodejs-cms-blog?style=social" alt="GitHub stars">
</p>

---

## ✨ Features

<table>
<tr>
<td width="50%">

**📝 Content Management**
- Rich blog posts & pages with WYSIWYG HTML editor
- Categories & tags with denormalized post counts
- Draft, published & scheduled post statuses
- Featured images & media library
- Comment moderation (pending → approved/spam)

</td>
<td width="50%">

**🎨 Theme System**
- Multi-theme support with template overrides
- Custom CSS/JS per theme via admin panel
- Ocean Blue theme included (Tailwind CSS)
- WordPress-style template hierarchy
- Static asset serving per theme

</td>
</tr>
<tr>
<td width="50%">

**🔗 WordPress Permalinks**
- Customizable URL structures
- Tags: `%postname%`, `%year%`, `%monthnum%`, `%day%`, `%category%`, `%author%`, `%post_id%`
- Presets: Day/name, Month/name, Numeric, Post name
- Old URL redirects when structure changes
- RSS feed & XML sitemap

</td>
<td width="50%">

**📈 SEO & Social**
- Per-post/page SEO fields (title, meta, OG, canonical)
- Open Graph & Twitter Card support
- JSON-LD structured data (Article, WebSite, SearchAction)
- Auto-generated `robots.txt` & `sitemap.xml`
- Breadcrumb support & focus keyphrase

</td>
</tr>
<tr>
<td width="50%">

**🔒 Security**
- bcrypt password hashing (salt rounds: 12)
- CSRF protection (tokens per session)
- Rate limiting (configurable windows)
- Helmet security headers + CSP
- File upload validation (magic bytes)
- Session management (MongoStore)

</td>
<td width="50%">

**👥 Administration**
- Role-based access (admin, editor, author)
- Full CRUD for all content types
- Media library with thumbnail generation
- Audit logging (all actions tracked)
- Navigation management
- Theme management panel
- Global settings

</td>
</tr>
</table>

---

## 🚀 Quick Start

```bash
# Prerequisites: Node.js 18+, MongoDB 6+

# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env   # or create manually (see .env reference below)

# 3. Seed the database (creates admin user + defaults)
npm run seed

# 4. Start the server
npm start

# 5. Open in browser
open http://localhost:3000
```

### Default Login

| URL                        | Email              | Password   |
|----------------------------|--------------------|------------|
| `http://localhost:3000/admin/login` | `admin@blog.com` | `admin123` |

### `.env` Configuration

```env
MONGODB_URI=mongodb://localhost:27017/blog-cms
SESSION_SECRET=your-super-secret-key-change-in-production
PORT=3000
NODE_ENV=development
SITE_URL=http://localhost:3000
```

> **⚠️** Always change `SESSION_SECRET` to a strong random value in production.

---

## 📸 Screenshots

<details>
<summary><b>Click to view screenshots</b></summary>

| Area | Description |
|------|-------------|
| **Homepage** | Public blog listing with paginated posts, categories, and tags sidebar |
| **Single Post** | Full post view with comments section |
| **Admin Dashboard** | Stats overview (posts, pages, comments, users, pending comments) |
| **Post Editor** | Create/edit posts with SEO fields (title, meta, OG, canonical) |
| **Media Library** | Uploaded images grid with preview modal |
| **Theme Manager** | List, activate, customize, create, and delete themes |
| **Settings** | Global site settings (name, SEO, permalinks, navigation, social) |
| **Audit Logs** | Filterable history of all admin actions |

</details>

---

## 🗂️ Project Structure

```
├── src/server.js             # App entry point
├── src/
│   ├── config/              # DB & session configuration
│   ├── models/              # 10 Mongoose schemas
│   ├── controllers/         # Route handlers
│   ├── middleware/           # Auth, security, themes, uploads
│   ├── routes/              # Public, admin, auth, API routes
│   ├── utils/               # Slug & permalink utilities
│   └── views/               # EJS templates
│       ├── layouts/         # Public & admin layouts
│       ├── public/          # Public-facing views
│       └── admin/           # Admin panel views
├── themes/                  # Theme system
│   ├── default/             # Built-in fallback theme
│   └── ocean-blue/          # Ocean Blue theme (example)
└── public/                  # Static assets & uploads
```

---

## 🧩 Key Technical Features

### Permalink System
WordPress-compatible URL routing with customizable structures:

```javascript
// Preset examples
'default':     '/post/%postname%/'
'day_name':    '/%year%/%monthnum%/%day%/%postname%/'
'numeric':     '/archives/%post_id%/'
```

### Theme System
Themes live in `themes/{slug}/` with a `theme.json` manifest. Template resolution follows a priority chain: **theme views → default views**. Activate themes from the admin panel with zero downtime.

### SEO Framework
Every content entity (posts, pages, categories, tags) has dedicated SEO fields. The `seoMeta()` helper generates Open Graph, Twitter Cards, and JSON-LD structured data automatically.

### Security Architecture
- **CSRF**: Token-based protection refreshed after every mutation
- **Rate limiting**: In-memory, configurable windows with `X-RateLimit` headers
- **File uploads**: Magic byte signature verification + MIME type validation
- **Session**: MongoDB-backed, httpOnly, secure in production

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [`INSTALLATION.md`](./INSTALLATION.md) | Step-by-step setup, configuration, and troubleshooting |
| [`DEVELOPER.md`](./DEVELOPER.md) | Complete developer reference (models, routes, middleware, extending) |

---

## 🛠️ Scripts

| Command             | Description                                  |
|---------------------|----------------------------------------------|
| `npm start`         | Start the server                             |
| `npm run dev`       | Start with nodemon (auto-restart on changes) |
| `npm run seed`      | Seed database (admin user + default settings)|
| `npm run lint`      | Run ESLint                                   |
| `npm run format`    | Format with Prettier                         |

---

## 🧰 Tech Stack

| Category      | Technology                                            |
|---------------|-------------------------------------------------------|
| **Runtime**   | Node.js (ES Modules)                                  |
| **Framework** | Express.js 5                                          |
| **Database**  | MongoDB + Mongoose 9 ODM                              |
| **Templates** | EJS 6                                                 |
| **Auth**      | bcryptjs + Express Session + MongoStore               |
| **Security**  | Helmet (CSP), CSRF tokens, Rate limiting, Magic bytes |
| **Uploads**   | Multer + Sharp (thumbnails)                           |
| **Styling**   | Tailwind CSS (CDN) + Bootstrap Icons                  |
| **Quality**   | ESLint + Prettier                                     |

---

## 🤝 Contributing

1. Fork the repository ([Vinodrajbhar/nodejs-cms-blog](https://github.com/Vinodrajbhar/nodejs-cms-blog))
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

See [`DEVELOPER.md`](./DEVELOPER.md) for detailed architecture and extension guides.

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

<p align="center">
  Built with ❤️ using Express.js & MongoDB
</p>
