import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
    },
    author: {
      name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
      },
      email: {
        type: String,
        required: [true, 'Email is required'],
        trim: true,
        lowercase: true,
      },
      website: {
        type: String,
        default: '',
        trim: true,
      },
    },
    content: {
      type: String,
      required: [true, 'Comment content is required'],
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'spam'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

commentSchema.index({ post: 1, status: 1 });
commentSchema.index({ status: 1, createdAt: -1 });
commentSchema.index({ email: 1 });

export default mongoose.model('Comment', commentSchema);
