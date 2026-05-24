import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware';
import { validationResult } from 'express-validator';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/error.middleware';
import { getOrCreateTodaySession } from '../services/session.service';
import { BASE_ACTIVITY_RATES } from '../constants';

async function computeEffectiveRate(
  sessionId: string,
  activityKey: 'clicks' | 'squats' | 'stepsPerThousand',
): Promise<{ rate: number; banned: boolean }> {
  const effects = await prisma.activeEffect.findMany({
    where: { sessionId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
  });

  let multiplier = 1;
  let banned = false;

  for (const e of effects) {
    const type = e.cardType.toLowerCase();
    const target = e.targetActivity;
    const activity = activityKey === 'stepsPerThousand' ? 'steps' : activityKey;

    if (type === 'ban_activity' && target === activity) { banned = true; break; }
    if (type === 'nerf_activities') multiplier -= e.value / 100;
    if (type === 'buff_activities') multiplier += e.value / 100;
  }

  return { rate: BASE_ACTIVITY_RATES[activityKey] * Math.max(0, multiplier), banned };
}

export async function recordClicks(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!validationResult(req).isEmpty()) throw new AppError('Invalid count', 422);
    const { count } = req.body as { count: number };
    const session = await getOrCreateTodaySession(req.userId!);
    const { rate, banned } = await computeEffectiveRate(session.id, 'clicks');
    if (banned) throw new AppError('Clicks are banned', 403);

    const secondsAdded = Math.floor(rate * count);
    const updated = await prisma.playerSession.update({
      where: { id: session.id },
      data: {
        clicks:      { increment: count },
        timeEarned:  { increment: secondsAdded },
        currentTime: { increment: secondsAdded },
      },
    });
    res.json({ secondsAdded, currentTime: updated.currentTime, dailyStats: buildStats(updated) });
  } catch (err) { next(err); }
}

export async function recordSquats(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!validationResult(req).isEmpty()) throw new AppError('Invalid count', 422);
    const { count } = req.body as { count: number };
    const session = await getOrCreateTodaySession(req.userId!);
    const { rate, banned } = await computeEffectiveRate(session.id, 'squats');
    if (banned) throw new AppError('Squats are banned', 403);

    const secondsAdded = Math.floor(rate * count);
    const updated = await prisma.playerSession.update({
      where: { id: session.id },
      data: { squats: { increment: count }, timeEarned: { increment: secondsAdded }, currentTime: { increment: secondsAdded } },
    });
    res.json({ secondsAdded, currentTime: updated.currentTime, dailyStats: buildStats(updated) });
  } catch (err) { next(err); }
}

export async function recordSteps(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!validationResult(req).isEmpty()) throw new AppError('Invalid steps', 422);
    const { steps } = req.body as { steps: number };
    const session = await getOrCreateTodaySession(req.userId!);

    const { rate, banned } = await computeEffectiveRate(session.id, 'stepsPerThousand');
    if (banned) throw new AppError('Steps are banned', 403);

    const previousSteps = session.steps;
    const newSteps = Math.max(steps, previousSteps);
    const addedSteps = newSteps - previousSteps;
    const secondsAdded = Math.floor((addedSteps / 1000) * rate);

    const updated = await prisma.playerSession.update({
      where: { id: session.id },
      data: {
        steps:       newSteps,
        timeEarned:  { increment: secondsAdded },
        currentTime: { increment: secondsAdded },
      },
    });
    res.json({ secondsAdded, currentTime: updated.currentTime, dailyStats: buildStats(updated) });
  } catch (err) { next(err); }
}

export async function getDailyStats(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const session = await getOrCreateTodaySession(req.userId!);
    res.json(buildStats(session));
  } catch (err) { next(err); }
}

export async function logSocialUsage(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { app, seconds } = req.body as { app: string; seconds: number };
    const session = await getOrCreateTodaySession(req.userId!);

    const updated = await prisma.playerSession.update({
      where: { id: session.id },
      data: {
        currentTime: { decrement: seconds },
        timeUsed:    { increment: seconds },
      },
    });
    res.json({ currentTime: updated.currentTime });
  } catch (err) { next(err); }
}

function buildStats(s: any) {
  return {
    date:       s.date,
    clicks:     s.clicks,
    squats:     s.squats,
    steps:      s.steps,
    timeEarned: s.timeEarned,
    timeUsed:   s.timeUsed,
  };
}
