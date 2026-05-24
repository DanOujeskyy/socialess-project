import { Router } from 'express';
import { body } from 'express-validator';
import { authMiddleware } from '../middleware/auth.middleware';
import { recordClicks, recordSquats, recordSteps, getDailyStats, logSocialUsage } from '../controllers/activities.controller';

const router = Router();

router.use(authMiddleware);
router.post('/clicks',       [body('count').isInt({ min: 1, max: 200 })], recordClicks);
router.post('/squats',       [body('count').isInt({ min: 1, max: 200 })], recordSquats);
router.post('/steps',        [body('steps').isInt({ min: 0, max: 100000 })], recordSteps);
router.get('/stats',         getDailyStats);
router.post('/social-usage', [body('app').isString(), body('seconds').isInt({ min: 1 })], logSocialUsage);

export default router;
