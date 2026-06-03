import mongoose from 'mongoose';

const postSchema = new mongoose.Schema(
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
    excerpt: {
      type: String,
      default: '',
      maxlength: [500, 'Excerpt cannot exceed 500 characters'],
    },
    featuredImage: {
      type: String,
      default: '',
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
      },
    ],
    tags: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tag',
      },
    ],
    status: {
      type: String,
      enum: ['draft', 'published', 'scheduled'],
      default: 'draft',
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    scheduledAt: {
      type: Date,
      default: null,
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

postSchema.index({ status: 1, publishedAt: -1 });
postSchema.index({ categories: 1, status: 1, publishedAt: -1 });
postSchema.index({ tags: 1, status: 1, publishedAt: -1 });
postSchema.index({ author: 1, status: 1 });
postSchema.index({ title: 'text', content: 'text', excerpt: 'text' });

postSchema.pre('save', function () {
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
    this.scheduledAt = null;
  }
  if (this.isModified('status') && this.status === 'scheduled' && this.scheduledAt) {
    this.publishedAt = this.scheduledAt;
  }
  if (this.isModified('status') && this.status === 'draft') {
    this.publishedAt = null;
    this.scheduledAt = null;
  }
});

export default mongoose.model('Post', postSchema);
