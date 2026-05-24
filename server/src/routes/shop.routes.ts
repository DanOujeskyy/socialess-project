import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { getShopItems, purchaseItem } from '../controllers/shop.controller';

const router = Router();

router.use(authMiddleware);
router.get('/',              getShopItems);
router.post('/:id/purchase', purchaseItem);

export default router;
