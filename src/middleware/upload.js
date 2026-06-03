import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Magic bytes for common image types
const MAGIC_BYTES = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47],
  'image/gif': [0x47, 0x49, 0x46],
  'image/webp': [0x52, 0x49, 0x46, 0x46], // RIFF header
  'image/svg+xml': [0x3c, 0x73, 0x76, 0x67], // "<svg"
};

// Check file magic bytes against expected signature
function validateMagicBytes(filePath, mimeType) {
  const expected = MAGIC_BYTES[mimeType];
  if (!expected) return true; // skip validation for unknown types
  try {
    const buffer = Buffer.alloc(expected.length);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, expected.length, 0);
    fs.closeSync(fd);
    return buffer.equals(Buffer.from(expected));
  } catch {
    return false;
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', '..', 'public', 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, GIF, WebP, SVG) are allowed'));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter,
});

// Middleware to validate file magic bytes after multer processes the file
export const validateFileContent = (req, res, next) => {
  if (!req.file) return next();
  const valid = validateMagicBytes(req.file.path, req.file.mimetype);
  if (!valid) {
    // Clean up the invalid file
    fs.unlink(req.file.path, () => {});
    const mediaItemsPromise = import('../models/Media.js').then((m) =>
      m.default.find({}).sort({ createdAt: -1 }).lean()
    );
    return mediaItemsPromise
      .then((mediaItems) => {
        res.render('admin/media/index', {
          title: 'Media Library',
          mediaItems,
          error: 'Invalid file content. The file does not match its declared type.',
        });
      })
      .catch(() => {
        res.redirect('/admin/media');
      });
  }
  next();
};

export default upload;
