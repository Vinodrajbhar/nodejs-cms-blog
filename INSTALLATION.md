# Blog CMS — Installation & Running Guide

A full-featured blog CMS built with **Express.js 5**, **MongoDB**, and **EJS** — featuring a theme system, SEO tools, comment moderation, media library, audit logging, and role-based administration.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Step-by-Step Installation](#step-by-step-installation)
- [Configuration Reference](#configuration-reference)
- [Running the Application](#running-the-application)
- [Scripts](#scripts)
- [Default Credentials](#default-credentials)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Dependency | Minimum Version | How to Check        |
|------------|-----------------|---------------------|
| Node.js    | 18.x or later   | `node --version`    |
| npm        | 9.x or later    | `npm --version`     |
| MongoDB    | 6.x or later    | `mongod --version`  |

**Optional but recommended:**
- **MongoDB Compass** — GUI for browsing/monitoring the database
- **nodemon** — Auto-restarts the server on file changes (included as dev dependency)

---

## Quick Start

```bash
# 1. Clone the repository
git clone <repo-url> && cd nodejs-expressjs

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env   # or manually create .env (see below)

# 4. Ensure MongoDB is running locally
mongod --dbpath /data/db   # or start via brew/services

# 5. Seed the database (creates admin user + default settings)
npm run seed

# 6. Start the server
npm start

# 7. Open in browser
open http://localhost:3000
```

---

## Step-by-Step Installation

### 1. Install Node.js

**macOS (Homebrew):**
```bash
brew install node
```

**Others:** Download from [nodejs.org](https://nodejs.org/) (LTS version recommended).

### 2. Install & Start MongoDB

**macOS (Homebrew):**
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

**Verify MongoDB is running:**
```bash
mongosh --eval "db.adminCommand('ping')"
```

**Docker (alternative):**
```bash
docker run -d -p 27017:27017 --name mongo mongo:7
```

### 3. Clone the Project

```bash
git clone <repository-url>
cd nodejs-expressjs
```

### 4. Install Dependencies

```bash
npm install
```

This installs all runtime and development dependencies, including:
- `express` — Web framework
- `mongoose` — MongoDB ODM
- `ejs` — Template engine
- `bcryptjs` — Password hashing
- `helmet` — Security headers
- `multer` — File uploads
- `sharp` — Image thumbnails
- `eslint` / `prettier` — Code quality

### 5. Create Environment File

Create a `.env` file in the project root:

```env
MONGODB_URI=mongodb://localhost:27017/blog-cms
SESSION_SECRET=your-super-secret-key-change-in-production
PORT=3000
NODE_ENV=development
SITE_URL=http://localhost:3000
```

| Variable           | Required | Default                        | Description                                    |
|--------------------|----------|--------------------------------|------------------------------------------------|
| `MONGODB_URI`      | **Yes**  | —                              | MongoDB connection string                      |
| `SESSION_SECRET`   | **Yes**  | `fallback-secret-key` (weak)   | Session signing secret (use a strong value!)   |
| `PORT`             | No       | `3000`                         | Port the server listens on                     |
| `NODE_ENV`         | No       | `development`                  | `development` or `production`                  |
| `SITE_URL`         | No       | `http://localhost:PORT`        | Public site URL (used in sitemap/RSS/canonical)|

> **⚠️ Security:** Always change `SESSION_SECRET` to a strong, unique value in production.

### 6. Seed the Database

```bash
npm run seed
```

This creates:
- **Admin user:** `admin@blog.com` / `admin123`
- **Default settings:** site name, permalink structure, etc.
- **Default theme record** in the database

### 7. Start the Server

```bash
npm start
```

You should see:

```
Server running at http://localhost:3000
MongoDB connected: localhost
[Theme] Views paths: /path/to/themes/ocean-blue/views : /path/to/src/views
```

---

## Configuration Reference

### Available Settings (configured in Admin Panel)

The admin panel at `/admin/settings` exposes the following settings:

| Setting                  | Description                                       |
|--------------------------|---------------------------------------------------|
| `siteName`               | Site name (header, title tags)                    |
| `siteTagline`            | Short site description (meta description fallback)|
| `postsPerPage`           | Posts per page on homepage                        |
| `titleSeparator`         | Character between page title and site name        |
| `homepageSeoTitle`       | Custom SEO title for the homepage                 |
| `homepageMetaDescription`| Custom meta description for homepage              |
| `homepageOgImage`        | Default OG image for social sharing               |
| `twitterUsername`        | Twitter/X handle (Twitter Card)                   |
| `facebookUrl`            | Facebook page URL                                 |
| `noindexSite`            | Prevent search engines from indexing the site     |
| `permalinkStructure`     | URL structure for posts (e.g. `/post/%postname%/`)|                       |
| `categoryBase`           | URL prefix for categories (default: `category`)   |
| `tagBase`                | URL prefix for tags (default: `tag`)              |
| `activeTheme`            | Currently active theme slug                       |
| `navigation`             | Custom navigation menu items                      |

### Permalink Structures

Supported structure tags (WordPress-compatible):

| Tag             | Description           |
|-----------------|-----------------------|
| `%postname%`    | Post slug             |
| `%post_id%`     | Numeric post ID       |
| `%year%`        | 4-digit year          |
| `%monthnum%`    | 2-digit month (01–12) |
| `%day%`         | 2-digit day (01–31)   |
| `%category%`    | Category slug         |
| `%author%`      | Author username       |

Built-in presets:
- **Default:** `/post/%postname%/`
- **Post name:** `/%postname%/`
- **Day & name:** `/%year%/%monthnum%/%day%/%postname%/`
- **Month & name:** `/%year%/%monthnum%/%postname%/`
- **Numeric:** `/archives/%post_id%/`

---

## Running the Application

### Development Mode

```bash
npm run dev
```

Uses **nodemon** — automatically restarts the server when you make changes to `.js`, `.ejs`, or `.json` files.

### Production Mode

```bash
NODE_ENV=production npm start
```

In production mode:
- Static assets are cached for 7 days (vs. no caching in dev)
- Session cookies use `secure: true` (requires HTTPS)
- CSP headers are enforced

### Health Check

```bash
curl http://localhost:3000/health
```

Returns JSON with database status, uptime, and memory usage:

```json
{
  "status": "ok",
  "uptime": 123.45,
  "timestamp": "2026-06-03T06:00:00.000Z",
  "database": "connected",
  "memory": { ... },
  "env": "development"
}
```

---

## Scripts

| Command              | Description                                         |
|----------------------|-----------------------------------------------------|
| `npm start`          | Start the server with Node.js                       |
| `npm run dev`        | Start with nodemon (auto-restart on changes)        |
| `npm run seed`       | Seed the database (admin user + default settings)   |
| `npm run lint`       | Run ESLint on all source files                      |
| `npm run format`     | Format code with Prettier                           |

---

## Default Credentials

After running `npm run seed`:

| Role    | Email              | Password   |
|---------|--------------------|------------|
| Admin   | `admin@blog.com`   | `admin123` |

**Admin panel URL:** `http://localhost:3000/admin/login`

---

## Troubleshooting

### "MongoDB connection error"

Ensure MongoDB is running:
```bash
# macOS (Homebrew)
brew services list

# Check if mongod process exists
ps aux | grep mongod

# Start if not running
brew services start mongodb-community
```

### "Server running at ..." but page shows errors

Check the terminal for error logs. Common causes:
- Missing `.env` file
- MongoDB not seeded (`npm run seed`)
- Port 3000 already in use (change `PORT` in `.env`)

### "CSRF token invalid" in admin panel

Clear your browser cookies or open a new private window. Session may have expired.

### "EJS: cannot find module" or template errors

Ensure theme views exist in the active theme's `views/public/` folder.
Check that `npm install` was run successfully.

### Port already in use

```bash
# Find and kill the process on port 3000
lsof -ti:3000 | xargs kill -9
```

### File uploads fail

- Check the `public/uploads/` directory exists and is writable
- File size limit is 5MB
- Allowed types: JPEG, PNG, GIF, WebP, SVG
