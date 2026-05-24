import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { getState, getTodaysEventCard, claimDailyRewards } from '../controllers/session.controller';

const router = Router();

router.use(authMiddleware);
router.get('/state',         getState);
router.get('/event-card',    getTodaysEventCard);
router.post('/daily-rewards', claimDailyRewards);

export default router;
