import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { getMyCrates, openCrate, claimAdCrate } from '../controllers/crates.controller';

const router = Router();

router.use(authMiddleware);
router.get('/',        getMyCrates);
router.post('/:id/open', openCrate);
router.post('/ad',     claimAdCrate);

export default router;
