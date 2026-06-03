import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      unique: true,
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
    postCount: {
      type: Number,
      default: 0,
    },
    // SEO fields
    seoTitle: {
      type: String,
      default: '',
    },
    metaDescription: {
      type: String,
      default: '',
    },
    noindex: {
      type: Boolean,
      default: false,
    },
    ogImage: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

export default mongoose.model('Category', categorySchema);
