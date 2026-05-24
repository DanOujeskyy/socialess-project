import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/error.middleware';
import {
  getOrCreateTodaySession,
  claimDailyRewards as claimRewardsService,
  generateEventCard,
} from '../services/session.service';
import { startOfDay } from 'date-fns';

export async function getState(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const session = await getOrCreateTodaySession(req.userId!);
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { currentStreak: true, username: true, avatar: true },
    });
    const cards = await prisma.gameCard.findMany({
      where: { userId: req.userId!, usedAt: null },
      orderBy: { obtainedAt: 'desc' },
    });

    res.json({
      userId:      req.userId,
      username:    user?.username,
      avatar:      user?.avatar,
      currentTime: session.currentTime,
      maxTime:     session.maxTime,
      activeEffects: session.activeEffects,
      cards,
      dailyStats: {
        date:       session.date,
        clicks:     session.clicks,
        squats:     session.squats,
        steps:      session.steps,
        timeEarned: session.timeEarned,
        timeUsed:   session.timeUsed,
      },
      streak: user?.currentStreak ?? 0,
      isEliminated: false,
    });
  } catch (err) { next(err); }
}

export async function getTodaysEventCard(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const today = startOfDay(new Date());
    const session = await getOrCreateTodaySession(req.userId!);

    let eventCard = session.eventCard;
    if (!eventCard) {
      eventCard = await generateEventCard(session.id);
    }

    res.json({
      id:          eventCard.id,
      type:        eventCard.type.toLowerCase(),
      rarity:      eventCard.rarity.toLowerCase(),
      effect: {
        type:     eventCard.type.toLowerCase(),
        rarity:   eventCard.rarity.toLowerCase(),
        value:    eventCard.effectValue,
        duration: eventCard.effectDuration,
      },
      date:        eventCard.date,
      activeUntil: eventCard.activeUntil,
      isActive:    eventCard.isActive,
    });
  } catch (err) { next(err); }
}

export async function claimDailyRewards(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const results = await claimRewardsService(req.userId!);
    res.json(results);
  } catch (err) { next(err); }
}
