import { Router } from 'express';
import { body } from 'express-validator';
import { authMiddleware } from '../middleware/auth.middleware';
import { login, register, refresh, logout, getMe, updatePushToken } from '../controllers/auth.controller';

const router = Router();

router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('username').isLength({ min: 3, max: 20 }).trim(),
    body('password').isLength({ min: 8 }),
  ],
  register,
);

router.post(
  '/login',
  [body('email').isEmail().normalizeEmail(), body('password').exists()],
  login,
);

router.post('/refresh', refresh);
router.post('/logout', authMiddleware, logout);
router.get('/me', authMiddleware, getMe);
router.patch('/push-token', authMiddleware, updatePushToken);

export default router;
