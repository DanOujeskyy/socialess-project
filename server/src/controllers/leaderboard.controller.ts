import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';

export async function getGlobalLeaderboard(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const users = await prisma.user.findMany({
      orderBy: { rankPoints: 'desc' },
      take: 100,
      select: {
        id: true, username: true, avatar: true,
        rankPoints: true, rankTier: true, rankedWins: true, rankedLosses: true,
        level: true,
      },
    });

    const entries = users.map((u, i) => ({
      rank:         i + 1,
      userId:       u.id,
      username:     u.username,
      avatar:       u.avatar,
      rankPoints:   u.rankPoints,
      rankTier:     u.rankTier.toLowerCase(),
      rankedWins:   u.rankedWins,
      rankedLosses: u.rankedLosses,
      level:        u.level,
    }));

    res.json(entries);
  } catch (err) { next(err); }
}

export async function getWeeklyLeaderboard(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    // Weekly = players who won the most ranked matches this week
    const results = await prisma.challengePlayer.groupBy({
      by: ['userId'],
      where: {
        challenge: {
          mode: 'RANKED',
          status: 'ENDED',
          endedAt: { gte: weekAgo },
        },
        placement: 1,
      },
      _count: { userId: true },
      orderBy: { _count: { userId: 'desc' } },
      take: 50,
    });

    if (results.length === 0) { res.json([]); return; }

    const userIds = results.map((r) => r.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true, avatar: true, rankPoints: true, rankTier: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const entries = results.map((r, i) => {
      const u = userMap.get(r.userId);
      return {
        rank:       i + 1,
        userId:     r.userId,
        username:   u?.username ?? '?',
        avatar:     u?.avatar,
        rankPoints: u?.rankPoints ?? 0,
        rankTier:   (u?.rankTier ?? 'BRONZE').toLowerCase(),
        weeklyWins: r._count.userId,
      };
    });

    res.json(entries);
  } catch (err) { next(err); }
}

export async function getMyRank(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { id: true, username: true, avatar: true, rankPoints: true, rankTier: true, rankedWins: true, rankedLosses: true, level: true },
    });
    if (!user) { res.status(404).json({ message: 'User not found' }); return; }

    const rank = (await prisma.user.count({ where: { rankPoints: { gt: user.rankPoints } } })) + 1;

    // Players just above and below
    const above = await prisma.user.findMany({
      where: { rankPoints: { gt: user.rankPoints } },
      orderBy: { rankPoints: 'asc' },
      take: 3,
      select: { id: true, username: true, rankPoints: true, rankTier: true, avatar: true },
    });
    const below = await prisma.user.findMany({
      where: { rankPoints: { lt: user.rankPoints } },
      orderBy: { rankPoints: 'desc' },
      take: 3,
      select: { id: true, username: true, rankPoints: true, rankTier: true, avatar: true },
    });

    res.json({
      me: {
        rank,
        userId:       user.id,
        username:     user.username,
        avatar:       user.avatar,
        rankPoints:   user.rankPoints,
        rankTier:     user.rankTier.toLowerCase(),
        rankedWins:   user.rankedWins,
        rankedLosses: user.rankedLosses,
        level:        user.level,
      },
      surrounding: [
        ...above.reverse().map((u, i) => ({ ...u, rankTier: u.rankTier.toLowerCase(), rank: rank - above.length + i })),
        ...below.map((u, i) => ({ ...u, rankTier: u.rankTier.toLowerCase(), rank: rank + 1 + i })),
      ],
    });
  } catch (err) { next(err); }
}
