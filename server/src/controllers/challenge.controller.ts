import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/error.middleware';
import { DEFAULT_MAX_TIME_SECONDS, DAILY_FREE_TIME_SECONDS } from '../constants';
import { generateEventCard } from '../services/session.service';
import { io } from '../index';

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function buildDefaultSettings(mode: string, overrides: any = {}) {
  return {
    startingTime:    DAILY_FREE_TIME_SECONDS,
    maxTime:         DEFAULT_MAX_TIME_SECONDS,
    enabledCardTypes: mode === 'singleplayer' ? [] : ['nerf_activities', 'buff_activities', 'ban_activity', 'limit_time_capacity', 'reduce_time', 'increase_time', 'reduce_time_frequently', 'increase_time_frequently', 'more_game_cards'],
    trackedApps: ['instagram', 'youtube', 'snapchat', 'tiktok', 'facebook'],
    activityRates: { clicks: 15, squats: 10, stepsPerThousand: 90 },
    ...overrides,
  };
}

function formatChallenge(c: any) {
  return {
    id: c.id, code: c.code, mode: c.mode.toLowerCase(), hostId: c.hostId,
    status: c.status.toLowerCase(),
    settings: c.settings,
    penalties: c.penalties,
    createdAt: c.createdAt, startedAt: c.startedAt, endedAt: c.endedAt,
    players: c.players?.map((cp: any) => ({
      userId:      cp.userId,
      username:    cp.user?.username,
      avatar:      cp.user?.avatar,
      currentTime: 0,
      maxTime:     DEFAULT_MAX_TIME_SECONDS,
      activeEffects: cp.activeEffects ?? [],
      cards:       [],
      dailyStats:  { date: new Date(), clicks: 0, squats: 0, steps: 0, timeEarned: 0, timeUsed: 0 },
      streak:      0,
      isEliminated: cp.isEliminated,
    })) ?? [],
  };
}

export async function createChallenge(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { mode, settings } = req.body as { mode: string; settings: any };
    if (!['singleplayer', 'multiplayer', 'custom'].includes(mode)) {
      throw new AppError('Invalid mode', 422);
    }

    let code: string;
    do { code = generateCode(); }
    while (await prisma.challenge.findUnique({ where: { code } }));

    const challenge = await prisma.challenge.create({
      data: {
        code,
        mode: mode.toUpperCase() as any,
        hostId: req.userId!,
        settings: buildDefaultSettings(mode, settings),
        players: {
          create: [{ userId: req.userId! }],
        },
      },
      include: { players: { include: { user: true, activeEffects: true } } },
    });

    if (mode !== 'singleplayer') {
      await generateEventCard(undefined, challenge.id);
    }

    res.status(201).json(formatChallenge(challenge));
  } catch (err) { next(err); }
}

export async function joinChallenge(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { code } = req.body as { code: string };
    const challenge = await prisma.challenge.findUnique({
      where: { code: code.toUpperCase() },
      include: { players: { include: { user: true, activeEffects: true } } },
    });
    if (!challenge) throw new AppError('Challenge not found', 404);
    if (challenge.status !== 'LOBBY') throw new AppError('Game already started', 400);

    const existing = challenge.players.find((p) => p.userId === req.userId);
    if (!existing) {
      await prisma.challengePlayer.create({
        data: { challengeId: challenge.id, userId: req.userId! },
      });
    }

    const updated = await prisma.challenge.findUnique({
      where: { id: challenge.id },
      include: { players: { include: { user: true, activeEffects: true } } },
    });

    io.to(challenge.id).emit('challenge:updated', formatChallenge(updated));
    res.json(formatChallenge(updated));
  } catch (err) { next(err); }
}

export async function getChallenge(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const challenge = await prisma.challenge.findUnique({
      where: { id: req.params.id },
      include: { players: { include: { user: true, activeEffects: true } } },
    });
    if (!challenge) throw new AppError('Not found', 404);
    res.json(formatChallenge(challenge));
  } catch (err) { next(err); }
}

export async function startChallenge(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const challenge = await prisma.challenge.findUnique({
      where: { id: req.params.id },
      include: { players: { include: { user: true, activeEffects: true } } },
    });
    if (!challenge) throw new AppError('Not found', 404);
    if (challenge.hostId !== req.userId) throw new AppError('Only the host can start', 403);
    if (challenge.status !== 'LOBBY') throw new AppError('Already started', 400);

    const updated = await prisma.challenge.update({
      where: { id: challenge.id },
      data: { status: 'ACTIVE', startedAt: new Date() },
      include: { players: { include: { user: true, activeEffects: true } } },
    });

    const formatted = formatChallenge(updated);
    io.to(challenge.id).emit('challenge:updated', formatted);
    res.json(formatted);
  } catch (err) { next(err); }
}

export async function leaveChallenge(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await prisma.challengePlayer.deleteMany({
      where: { challengeId: req.params.id, userId: req.userId! },
    });
    res.json({ message: 'Left challenge' });
  } catch (err) { next(err); }
}
