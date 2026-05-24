import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { spinWheel, claimAdSpin } from '../controllers/spin.controller';

const router = Router();

router.use(authMiddleware);
router.post('/',    spinWheel);
router.post('/ad',  claimAdSpin);

export default router;
