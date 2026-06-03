import mongoose from 'mongoose';

const pageSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    content: {
      type: String,
      default: '',
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft',
    },
    featuredImage: {
      type: String,
      default: '',
    },
    // SEO fields
    seoTitle: {
      type: String,
      default: '',
    },
    metaDescription: {
      type: String,
      default: '',
      maxlength: [160, 'Meta description cannot exceed 160 characters'],
    },
    focusKeyphrase: {
      type: String,
      default: '',
    },
    ogImage: {
      type: String,
      default: '',
    },
    ogTitle: {
      type: String,
      default: '',
    },
    ogDescription: {
      type: String,
      default: '',
    },
    canonicalUrl: {
      type: String,
      default: '',
    },
    noindex: {
      type: Boolean,
      default: false,
    },
    breadcrumbTitle: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

export default mongoose.model('Page', pageSchema);
