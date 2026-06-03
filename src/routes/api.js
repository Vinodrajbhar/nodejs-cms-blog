import express from 'express';
import Comment from '../models/Comment.js';

const router = express.Router();

// Submit a comment
router.post('/comments', async (req, res) => {
  try {
    const { postId, name, email, website, content } = req.body;

    if (!postId || !name || !email || !content) {
      if (req.xhr || req.accepts('json')) {
        return res.status(400).json({ error: 'Missing required fields.' });
      }
      return res.redirect('back');
    }

    const comment = await Comment.create({
      post: postId,
      author: { name, email, website: website || '' },
      content,
      status: 'pending',
    });

    // If AJAX request (from the fetch in post.ejs), return JSON
    if (req.xhr || req.accepts('json')) {
      return res.status(201).json({ message: 'Comment submitted for moderation.', comment });
    }

    // Regular form POST — redirect back with a success flag
    res.redirect('back');
  } catch (error) {
    console.error('Comment API error:', error);
    if (req.xhr || req.accepts('json')) {
      return res.status(500).json({ error: 'Failed to submit comment.' });
    }
    res.redirect('back');
  }
});

export default router;
