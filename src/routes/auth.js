import express from 'express';
import { getLogin, postLogin, logout } from '../controllers/authController.js';

const router = express.Router();

router.get('/login', getLogin);
router.post('/login', postLogin);
router.get('/logout', logout);

export default router;
