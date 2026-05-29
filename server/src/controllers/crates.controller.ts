import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/error.middleware';
import { rollRarity, rollCardType } from '../services/session.service';
import { CARD_VALUES } from '../constants';
import { startOfDay } from 'date-fns';

export async function getMyCrates(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const crates = await prisma.crate.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.json(crates.map((c) => ({
      id: c.id, type: c.type.toLowerCase(), opened: c.opened, openedAt: c.openedAt, rewardId: c.rewardId,
    })));
  } catch (err) { next(err); }
}

export async function openCrate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const crate = await prisma.crate.findFirst({
      where: { id: req.params.id as string, userId: req.userId!, opened: false },
    });
    if (!crate) throw new AppError('Crate not found or already opened', 404);

    const rarity = rollRarity();
    const type   = rollCardType(true);
    const value  = CARD_VALUES[type][rarity];

    const card = await prisma.gameCard.create({
      data: {
        userId:      req.userId!,
        type:        type.toUpperCase() as any,
        rarity:      rarity.toUpperCase() as any,
        effectValue: value,
      },
    });

    await prisma.crate.update({
      where: { id: crate.id },
      data: { opened: true, openedAt: new Date(), rewardId: card.id },
    });

    res.json({
      id: card.id, type: card.type.toLowerCase(), rarity: card.rarity.toLowerCase(),
      effect: { type: card.type.toLowerCase(), rarity: card.rarity.toLowerCase(), value: card.effectValue },
      obtainedAt: card.obtainedAt,
    });
  } catch (err) { next(err); }
}

export async function claimAdCrate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const today = startOfDay(new Date());
    const session = await prisma.playerSession.findUnique({
      where: { userId_date: { userId: req.userId!, date: today } },
    });
    if (session?.adCrateUsed) throw new AppError('Ad crate already claimed today', 400);

    const crate = await prisma.crate.create({
      data: { userId: req.userId!, type: 'AD' },
    });

    if (session) {
      await prisma.playerSession.update({ where: { id: session.id }, data: { adCrateUsed: true } });
    }

    res.json({ id: crate.id, type: 'ad', opened: false, createdAt: crate.createdAt });
  } catch (err) { next(err); }
}
