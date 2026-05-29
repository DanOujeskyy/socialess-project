import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { getGlobalLeaderboard, getWeeklyLeaderboard, getMyRank } from '../controllers/leaderboard.controller';

const router = Router();
router.use(authMiddleware);

router.get('/global',  getGlobalLeaderboard);
router.get('/weekly',  getWeeklyLeaderboard);
router.get('/me',      getMyRank);

export default router;
