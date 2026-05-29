import type { Response, NextFunction } from 'express';
import type { Server } from 'socket.io';
import type { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/error.middleware';
import {
  DEFAULT_MAX_TIME_SECONDS,
  DAILY_FREE_TIME_SECONDS,
  RANKED_SETTINGS,
  MAX_CARDS_PER_PLAYER,
  calcRankedPoints,
  getTierFromPoints,
} from '../constants';
import { generateEventCard, rollCardType, rollRarity } from '../services/session.service';
import { io } from '../index';

// ── Helpers ────────────────────────────────────────────────────────────────────

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function buildDefaultSettings(mode: string, overrides: any = {}) {
  const base = {
    startingTime:         DAILY_FREE_TIME_SECONDS,
    maxTime:              DEFAULT_MAX_TIME_SECONDS,
    startingCards:        0,
    eliminationThreshold: 0,
    enabledCardTypes: mode === 'singleplayer' ? [] : [
      'nerf_activities', 'buff_activities', 'ban_activity', 'limit_time_capacity',
      'reduce_time', 'increase_time', 'reduce_time_frequently', 'increase_time_frequently',
      'more_game_cards',
    ],
    trackedApps: ['instagram', 'youtube', 'snapchat', 'tiktok', 'facebook'],
    activityRates: { clicks: 15, squats: 10, stepsPerThousand: 90 },
  };
  return { ...base, ...overrides };
}

function todayDate(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Fetch real session data for each player and format the challenge response
async function formatChallenge(c: any) {
  const playerIds: string[] = c.players?.map((p: any) => p.userId) ?? [];

  const [sessions, cards] = await Promise.all([
    prisma.playerSession.findMany({
      where: { userId: { in: playerIds }, date: todayDate() },
      include: { activeEffects: true },
    }),
    prisma.gameCard.findMany({
      where: { userId: { in: playerIds }, usedAt: null },
    }),
  ]);

  const sessionMap = new Map(sessions.map((s) => [s.userId, s]));
  const cardsByUser = new Map<string, typeof cards[0][]>();
  for (const card of cards) {
    if (!cardsByUser.has(card.userId)) cardsByUser.set(card.userId, []);
    cardsByUser.get(card.userId)!.push(card);
  }

  return {
    id: c.id,
    code: c.code,
    mode: c.mode.toLowerCase(),
    hostId: c.hostId,
    status: c.status.toLowerCase(),
    settings: c.settings,
    penalties: (() => {
      if (!c.penalties) return null;
      try { return JSON.parse(c.penalties as string); } catch { return null; }
    })(),
    createdAt: c.createdAt,
    startedAt: c.startedAt,
    endedAt: c.endedAt,
    players: c.players?.map((cp: any) => {
      const session = sessionMap.get(cp.userId);
      const settings = c.settings as any;
      return {
        userId:      cp.userId,
        username:    cp.user?.username,
        avatar:      cp.user?.avatar,
        currentTime: session?.currentTime ?? 0,
        maxTime:     session?.maxTime ?? (settings?.maxTime ?? DEFAULT_MAX_TIME_SECONDS),
        activeEffects: (session?.activeEffects ?? cp.activeEffects ?? []).map((e: any) => ({
          id:              e.id,
          cardType:        e.cardType.toLowerCase(),
          rarity:          e.rarity.toLowerCase(),
          value:           e.value,
          appliedAt:       e.appliedAt,
          expiresAt:       e.expiresAt,
          targetActivity:  e.targetActivity,
          appliedById:     e.appliedById,
          intervalMinutes: e.intervalMinutes,
          lastAppliedAt:   e.lastAppliedAt,
        })),
        cards: (cardsByUser.get(cp.userId) ?? []).map((card: any) => ({
          id:          card.id,
          type:        card.type.toLowerCase(),
          rarity:      card.rarity.toLowerCase(),
          effect: {
            type:           card.type.toLowerCase(),
            rarity:         card.rarity.toLowerCase(),
            value:          card.effectValue,
            duration:       card.effectDuration,
            targetActivity: card.targetActivity,
          },
          obtainedAt:     card.obtainedAt,
          usedAt:         card.usedAt,
          targetPlayerId: card.targetPlayerId,
        })),
        dailyStats: session ? {
          date:       session.date,
          clicks:     session.clicks,
          squats:     session.squats,
          steps:      session.steps,
          timeEarned: session.timeEarned,
          timeUsed:   session.timeUsed,
        } : { date: new Date(), clicks: 0, squats: 0, steps: 0, timeEarned: 0, timeUsed: 0 },
        streak:       cp.user?.currentStreak ?? 0,
        isEliminated: cp.isEliminated,
        placement:    cp.placement ?? null,
        pointsChange: cp.pointsChange ?? null,
        rankPoints:   cp.user?.rankPoints ?? 0,
        rankTier:     (cp.user?.rankTier ?? 'BRONZE').toLowerCase(),
      };
    }) ?? [],
  };
}

// ── End Game (shared, called from activities controller and socket) ─────────────

export async function endChallenge(challengeId: string, ioServer: Server) {
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
    include: { players: { include: { user: true } } },
  });
  if (!challenge || challenge.status !== 'ACTIVE') return;

  const sessions = await prisma.playerSession.findMany({
    where: { userId: { in: challenge.players.map((p) => p.userId) }, date: todayDate() },
  });
  const sessionMap = new Map(sessions.map((s) => [s.userId, s]));

  // Sort non-eliminated players by currentTime desc, then append eliminated ones
  const alive     = challenge.players.filter((p) => !p.isEliminated);
  const eliminated = challenge.players.filter((p) => p.isEliminated);
  alive.sort((a, b) => (sessionMap.get(b.userId)?.currentTime ?? 0) - (sessionMap.get(a.userId)?.currentTime ?? 0));
  const ordered = [...alive, ...eliminated];

  await prisma.challenge.update({
    where: { id: challengeId },
    data: { status: 'ENDED', endedAt: new Date() },
  });

  const results: { userId: string; username: string; placement: number; currentTime: number; pointsChange: number | null; rankPoints: number; rankTier: string }[] = [];

  for (let i = 0; i < ordered.length; i++) {
    const cp        = ordered[i];
    // Alive players always win (placement 1); eliminated already have their placement
    const placement = cp.isEliminated ? (cp.placement ?? i + 1) : 1;

    if (challenge.mode === 'RANKED') {
      const isBot = !!(cp.user as any)?.isBot;

      if (!cp.isEliminated && !isBot) {
        // Winner — award points and increment wins
        const pointsChange = calcRankedPoints(1, ordered.length);
        const user = await prisma.user.findUnique({ where: { id: cp.userId } });
        if (user) {
          const newPoints = Math.max(0, user.rankPoints + pointsChange);
          const newTier   = getTierFromPoints(newPoints) as any;
          await prisma.user.update({
            where: { id: cp.userId },
            data: {
              rankPoints: newPoints,
              rankTier:   newTier,
              rankedWins: { increment: 1 },
            },
          });
          await prisma.challengePlayer.update({
            where: { id: cp.id },
            data:  { placement: 1, pointsChange },
          });
          results.push({
            userId:      cp.userId,
            username:    cp.user?.username ?? '',
            placement:   1,
            currentTime: sessionMap.get(cp.userId)?.currentTime ?? 0,
            pointsChange,
            rankPoints:  newPoints,
            rankTier:    newTier.toLowerCase(),
          });
        }
      } else {
        // Eliminated players already have their placement and pointsChange set by eliminatePlayer;
        // just include them in the results payload.
        const dbCp = await prisma.challengePlayer.findUnique({ where: { id: cp.id } });
        const user = await prisma.user.findUnique({ where: { id: cp.userId } });
        results.push({
          userId:      cp.userId,
          username:    cp.user?.username ?? '',
          placement,
          currentTime: sessionMap.get(cp.userId)?.currentTime ?? 0,
          pointsChange: dbCp?.pointsChange ?? null,
          rankPoints:   user?.rankPoints ?? cp.user?.rankPoints ?? 0,
          rankTier:     ((user?.rankTier ?? cp.user?.rankTier ?? 'BRONZE') as string).toLowerCase(),
        });
      }
    } else {
      results.push({
        userId:      cp.userId,
        username:    cp.user?.username ?? '',
        placement:   cp.isEliminated ? (cp.placement ?? i + 1) : 1,
        currentTime: sessionMap.get(cp.userId)?.currentTime ?? 0,
        pointsChange: null,
        rankPoints:   cp.user?.rankPoints ?? 0,
        rankTier:     (cp.user?.rankTier ?? 'BRONZE').toLowerCase(),
      });
      if (!cp.isEliminated) {
        await prisma.challengePlayer.update({
          where: { id: cp.id },
          data:  { placement: 1 },
        });
      }
    }
  }

  // Parse stored penalties JSON string (if any) so clients receive a typed array
  let penalties: { placement: number; description: string }[] | null = null;
  if (challenge.penalties) {
    try { penalties = JSON.parse(challenge.penalties as string); } catch { /* ignore */ }
  }

  ioServer.to(challengeId).emit('challenge:ended', {
    challengeId,
    mode: challenge.mode.toLowerCase(),
    players: results,
    penalties,
    endedAt: new Date().toISOString(),
  });
}

// ── Eliminate a single player ─────────────────────────────────────────────────
// For ranked games, placement and points are assigned immediately so the player
// sees their result even if they disconnect before the game fully ends.

export async function eliminatePlayer(userId: string, challengeId: string, ioServer: Server) {
  const cp = await prisma.challengePlayer.findUnique({
    where: { challengeId_userId: { challengeId, userId } },
    include: {
      challenge: { include: { players: { include: { user: true } } } },
      user: true,
    },
  });
  if (!cp || cp.isEliminated) return;

  // Mark eliminated first
  await prisma.challengePlayer.update({
    where: { id: cp.id },
    data:  { isEliminated: true, eliminatedAt: new Date() },
  });

  // Placement = 1 + number of players still alive after this elimination
  const remaining = cp.challenge.players.filter(
    (p) => !p.isEliminated && p.userId !== userId,
  );
  const placement = remaining.length + 1;

  // For ranked games, award/deduct points immediately so leaving players
  // always get their correct result without waiting for the game to fully end.
  if (cp.challenge.mode === 'RANKED') {
    const isBot = !!(cp.user as any)?.isBot;
    if (!isBot) {
      const pointsChange = calcRankedPoints(placement, cp.challenge.players.length);
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        const newPoints = Math.max(0, user.rankPoints + pointsChange);
        const newTier   = getTierFromPoints(newPoints) as any;
        await prisma.user.update({
          where: { id: userId },
          data:  {
            rankPoints:   newPoints,
            rankTier:     newTier,
            rankedLosses: { increment: 1 },
          },
        });
        await prisma.challengePlayer.update({
          where: { id: cp.id },
          data:  { placement, pointsChange },
        });
        // Notify the eliminated player of their result right away
        ioServer.to(`user:${userId}`).emit('ranked:elimination_result', {
          placement,
          pointsChange,
          newRankPoints: newPoints,
          newRankTier:   newTier.toLowerCase(),
        });
      }
    } else {
      await prisma.challengePlayer.update({
        where: { id: cp.id },
        data:  { placement },
      });
    }
  }

  ioServer.to(challengeId).emit('player:eliminated', { userId });

  // When only one player remains → declare winner and end the game
  if (remaining.length <= 1) {
    await endChallenge(challengeId, ioServer);
  }
}

// ── Route Handlers ─────────────────────────────────────────────────────────────

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
        mode:     mode.toUpperCase() as any,
        hostId:   req.userId!,
        settings: buildDefaultSettings(mode, settings),
        players:  { create: [{ userId: req.userId! }] },
      },
      include: { players: { include: { user: true, activeEffects: true } } },
    });

    if (mode !== 'singleplayer') {
      await generateEventCard(undefined, challenge.id);
    }

    res.status(201).json(await formatChallenge(challenge));
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

    const formatted = await formatChallenge(updated);
    io.to(challenge.id).emit('challenge:updated', formatted);
    res.json(formatted);
  } catch (err) { next(err); }
}

export async function getChallenge(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const challenge = await prisma.challenge.findUnique({
      where: { id },
      include: { players: { include: { user: true, activeEffects: true } } },
    });
    if (!challenge) throw new AppError('Not found', 404);
    res.json(await formatChallenge(challenge));
  } catch (err) { next(err); }
}

export async function updateChallengeSettings(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const { settings, penalties } = req.body as { settings?: any; penalties?: string };
    const challenge = await prisma.challenge.findUnique({
      where: { id },
      include: { players: { include: { user: true, activeEffects: true } } },
    });
    if (!challenge) throw new AppError('Not found', 404);
    if (challenge.hostId !== req.userId) throw new AppError('Only host can update settings', 403);
    if (challenge.status !== 'LOBBY') throw new AppError('Cannot update settings after game starts', 400);

    const merged = { ...(challenge.settings as any), ...(settings ?? {}) };
    const updated = await prisma.challenge.update({
      where: { id: challenge.id },
      data: {
        settings: merged,
        ...(penalties !== undefined && { penalties }),
      },
      include: { players: { include: { user: true, activeEffects: true } } },
    });

    const formatted = await formatChallenge(updated);
    io.to(challenge.id).emit('challenge:updated', formatted);
    res.json(formatted);
  } catch (err) { next(err); }
}

export async function startChallenge(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const challenge = await prisma.challenge.findUnique({
      where: { id },
      include: { players: { include: { user: true, activeEffects: true } } },
    });
    if (!challenge) throw new AppError('Not found', 404);
    if (challenge.hostId !== req.userId) throw new AppError('Only the host can start', 403);
    if (challenge.status !== 'LOBBY') throw new AppError('Already started', 400);

    const settings   = challenge.settings as any;
    const startTime  = settings.startingTime ?? DAILY_FREE_TIME_SECONDS;
    const maxTime    = settings.maxTime ?? DEFAULT_MAX_TIME_SECONDS;
    const startCards = settings.startingCards ?? 0;
    const today      = todayDate();

    // Grant each player their starting time and optionally cards
    for (const cp of challenge.players) {
      await prisma.playerSession.upsert({
        where: { userId_date: { userId: cp.userId, date: today } },
        create: { userId: cp.userId, date: today, currentTime: startTime, maxTime, freeTimeGiven: true },
        update: { currentTime: startTime, maxTime },
      });

      for (let k = 0; k < startCards; k++) {
        const currentCount = await prisma.gameCard.count({ where: { userId: cp.userId, usedAt: null } });
        if (currentCount >= MAX_CARDS_PER_PLAYER) break;
        const rarity   = rollRarity();
        const cardType = rollCardType(true);
        if (!cardType) continue;
        await prisma.gameCard.create({
          data: {
            userId:            cp.userId,
            type:              cardType.toUpperCase() as any,
            rarity:            rarity.toUpperCase() as any,
            effectValue:       1,
            usedInChallengeId: challenge.id,
          },
        });
      }
    }

    const updated = await prisma.challenge.update({
      where: { id: challenge.id },
      data: { status: 'ACTIVE', startedAt: new Date() },
      include: { players: { include: { user: true, activeEffects: true } } },
    });

    const formatted = await formatChallenge(updated);
    io.to(challenge.id).emit('challenge:updated', formatted);
    res.json(formatted);
  } catch (err) { next(err); }
}

export async function triggerEndChallenge(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const challenge = await prisma.challenge.findUnique({ where: { id } });
    if (!challenge) throw new AppError('Not found', 404);
    if (challenge.hostId !== req.userId) throw new AppError('Only host can end the game', 403);

    await endChallenge(id, io);
    res.json({ message: 'Game ended' });
  } catch (err) { next(err); }
}

export async function leaveChallenge(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const challenge = await prisma.challenge.findUnique({
      where: { id },
      include: { players: true },
    });
    if (!challenge) { res.json({ message: 'Left' }); return; }

    await prisma.challengePlayer.deleteMany({
      where: { challengeId: id, userId: req.userId! },
    });

    if (challenge.hostId === req.userId && challenge.status === 'LOBBY') {
      const remaining = challenge.players.filter((p) => p.userId !== req.userId);
      if (remaining.length === 0) {
        await prisma.challenge.update({ where: { id }, data: { status: 'ENDED' } });
      } else {
        const newHost = remaining[0];
        await prisma.challenge.update({ where: { id }, data: { hostId: newHost.userId } });
        const updated = await prisma.challenge.findUnique({
          where: { id },
          include: { players: { include: { user: true, activeEffects: true } } },
        });
        if (updated) {
          io.to(id).emit('challenge:updated', await formatChallenge(updated));
          io.to(id).emit('host:transferred', { newHostId: newHost.userId });
        }
      }
    }

    res.json({ message: 'Left challenge' });
  } catch (err) { next(err); }
}
