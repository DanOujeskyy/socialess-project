import { Router } from 'express';
import authRoutes        from './auth.routes';
import sessionRoutes     from './session.routes';
import challengeRoutes   from './challenge.routes';
import activitiesRoutes  from './activities.routes';
import cardsRoutes       from './cards.routes';
import cratesRoutes      from './crates.routes';
import shopRoutes        from './shop.routes';
import spinRoutes        from './spin.routes';
import leaderboardRoutes from './leaderboard.routes';

export const router = Router();

router.use('/auth',        authRoutes);
router.use('/session',     sessionRoutes);
router.use('/challenges',  challengeRoutes);
router.use('/activities',  activitiesRoutes);
router.use('/cards',       cardsRoutes);
router.use('/crates',      cratesRoutes);
router.use('/shop',        shopRoutes);
router.use('/spin',        spinRoutes);
router.use('/leaderboard', leaderboardRoutes);

router.get('/health', (_req, res) => res.json({ status: 'ok' }));
