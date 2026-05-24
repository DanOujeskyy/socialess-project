import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  createChallenge,
  joinChallenge,
  getChallenge,
  startChallenge,
  leaveChallenge,
} from '../controllers/challenge.controller';

const router = Router();

router.use(authMiddleware);
router.post('/',           createChallenge);
router.post('/join',       joinChallenge);
router.get('/:id',         getChallenge);
router.post('/:id/start',  startChallenge);
router.post('/:id/leave',  leaveChallenge);

export default router;
