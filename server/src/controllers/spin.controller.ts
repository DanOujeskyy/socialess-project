import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/error.middleware';
import { SPIN_WHEEL_WEIGHTS } from '../constants';
import { rollRarity, rollCardType } from '../services/session.service';
import { CARD_VALUES } from '../constants';
import { startOfDay } from 'date-fns';

function weightedPick<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  let rand = Math.random() * total;
  for (const item of items) {
    rand -= item.weight;
    if (rand <= 0) return item;
  }
  return items[items.length - 1];
}

export async function spinWheel(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const today = startOfDay(new Date());
    const session = await prisma.playerSession.findUnique({
      where: { userId_date: { userId: req.userId!, date: today } },
    });

    const canSpin = !session?.spinUsed || session?.adSpinUsed === false;
    if (session?.spinUsed && !session?.adSpinUsed) {
      throw new AppError('Already spun today. Watch an ad for another spin.', 400);
    }

    const picked = weightedPick(SPIN_WHEEL_WEIGHTS);

    let reward: any = { type: picked.type, label: '', value: null };

    if (picked.type === 'time_300') {
      await prisma.playerSession.update({
        where: { id: session?.id ?? '' },
        data: { currentTime: { increment: 300 } },
      });
      reward = { type: 'time', label: '+5 Minutes', value: 300 };
    } else if (picked.type === 'time_600') {
      await prisma.playerSession.update({
        where: { id: session?.id ?? '' },
        data: { currentTime: { increment: 600 } },
      });
      reward = { type: 'time', label: '+10 Minutes', value: 600 };
    } else if (picked.type.startsWith('crate')) {
      const crateType = picked.type === 'crate_premium' ? 'PREMIUM' : 'BASIC';
      const crate = await prisma.crate.create({ data: { userId: req.userId!, type: crateType as any } });
      reward = { type: 'crate', label: crateType === 'PREMIUM' ? 'Premium Crate' : 'Basic Crate', value: crate.id };
    } else if (picked.type === 'card') {
      const rarity = rollRarity();
      const type   = rollCardType(true);
      const value  = CARD_VALUES[type][rarity];
      const card = await prisma.gameCard.create({
        data: { userId: req.userId!, type: type.toUpperCase() as any, rarity: rarity.toUpperCase() as any, effectValue: value },
      });
      reward = {
        type: 'card',
        label: `${rarity} card`,
        value: { id: card.id, type: type, rarity, effect: { type, rarity, value } },
      };
    } else {
      reward = { type: 'extra_spin', label: 'Extra Spin', value: null };
      if (session) {
        await prisma.playerSession.update({ where: { id: session.id }, data: { adSpinUsed: false } });
      }
    }

    if (session) {
      await prisma.playerSession.update({
        where: { id: session.id },
        data: { spinUsed: true, adSpinUsed: true },
      });
    }

    res.json(reward);
  } catch (err) { next(err); }
}

export async function claimAdSpin(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const today = startOfDay(new Date());
    const session = await prisma.playerSession.findUnique({
      where: { userId_date: { userId: req.userId!, date: today } },
    });
    if (!session?.spinUsed) throw new AppError('You still have your free spin', 400);
    if (session?.adSpinUsed === false) throw new AppError('Ad spin already available', 400);

    await prisma.playerSession.update({ where: { id: session.id }, data: { adSpinUsed: false } });
    res.json({ canSpin: true });
  } catch (err) { next(err); }
}
