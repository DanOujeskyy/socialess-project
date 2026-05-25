import { Router } from 'express';
import { body } from 'express-validator';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  login, register, refresh, logout, getMe, updatePushToken,
  googleAuth, appleAuth, forgotPassword, resetPassword,
} from '../controllers/auth.controller';

const router = Router();

router.post(
  '/register',
  [
    body('email').isEmail().withMessage('Enter a valid email address').normalizeEmail(),
    body('username')
      .isLength({ min: 3, max: 20 }).withMessage('Username must be 3–20 characters')
      .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores')
      .trim(),
    body('password')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/\d/).withMessage('Password must contain at least one number'),
  ],
  register,
);

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Enter a valid email address').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  login,
);

router.post('/google', [body('accessToken').notEmpty().withMessage('Access token required')], googleAuth);
router.post('/apple', [body('identityToken').notEmpty().withMessage('Identity token required')], appleAuth);
router.post('/forgot-password', [body('email').isEmail().withMessage('Enter a valid email').normalizeEmail()], forgotPassword);
router.post('/reset-password', [body('email').isEmail().withMessage('Enter a valid email').normalizeEmail()], resetPassword);

router.post('/refresh', refresh);
router.post('/logout', authMiddleware, logout);
router.get('/me', authMiddleware, getMe);
router.patch('/push-token', authMiddleware, updatePushToken);

export default router;
