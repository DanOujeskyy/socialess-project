import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { getMyCards, useCard } from '../controllers/cards.controller';

const router = Router();

router.use(authMiddleware);
router.get('/',              getMyCards);
router.post('/:id/use',      useCard);

export default router;
