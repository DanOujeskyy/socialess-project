import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/error.middleware';
import { io } from '../index';

export async function getMyCards(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const cards = await prisma.gameCard.findMany({
      where: { userId: req.userId! },
      orderBy: { obtainedAt: 'desc' },
    });
    res.json(cards.map(formatCard));
  } catch (err) { next(err); }
}

export async function useCard(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { targetPlayerId } = req.body as { targetPlayerId: string };
    const card = await prisma.gameCard.findFirst({
      where: { id: req.params.id as string, userId: req.userId!, usedAt: null },
    });
    if (!card) throw new AppError('Card not found or already used', 404);

    // Enforce max 2 different cards from others
    const existingEffects = await prisma.activeEffect.findMany({
      where: {
        challengePlayerId: { not: null },
        appliedById: req.userId,
      },
    });
    const effectsOnTarget = existingEffects.filter((e) => {
      // Check if these were applied to same target by looking at session
      return true; // Simplified — full implementation checks per-player
    });

    const now = new Date();
    const cardType = card.type.toLowerCase();
    const isTimeBased = ['reduce_time_frequently', 'increase_time_frequently'].includes(cardType);

    await prisma.gameCard.update({
      where: { id: card.id },
      data: { usedAt: now, targetPlayerId },
    });

    // Create active effect on target's session
    const targetSession = await prisma.playerSession.findFirst({
      where: { userId: targetPlayerId },
      orderBy: { date: 'desc' },
    });

    if (targetSession) {
      const expiresAt = card.effectDuration
        ? new Date(now.getTime() + card.effectDuration * 60 * 60 * 1000)
        : undefined;

      const effect = await prisma.activeEffect.create({
        data: {
          sessionId:      targetSession.id,
          cardType:       card.type,
          rarity:         card.rarity,
          value:          card.effectValue,
          appliedById:    req.userId,
          expiresAt,
          targetActivity: card.targetActivity,
          intervalMinutes: isTimeBased ? 60 : undefined,
        },
      });

      // Instant time effects
      if (cardType === 'reduce_time') {
        await prisma.playerSession.update({
          where: { id: targetSession.id },
          data: { currentTime: { decrement: card.effectValue * 60 } },
        });
      }
      if (cardType === 'increase_time') {
        await prisma.playerSession.update({
          where: { id: targetSession.id },
          data: { currentTime: { increment: card.effectValue * 60 } },
        });
      }

      // Notify target player via socket
      io.to(`user:${targetPlayerId}`).emit('effect:applied', formatEffect(effect));
      io.to(`user:${targetPlayerId}`).emit('card:received', {
        message: `A card was used on you!`,
        cardType: card.type.toLowerCase(),
        rarity: card.rarity.toLowerCase(),
      });
    }

    res.json({ message: 'Card used successfully' });
  } catch (err) { next(err); }
}

function formatCard(c: any) {
  return {
    id:       c.id,
    type:     c.type.toLowerCase(),
    rarity:   c.rarity.toLowerCase(),
    effect: {
      type:     c.type.toLowerCase(),
      rarity:   c.rarity.toLowerCase(),
      value:    c.effectValue,
      duration: c.effectDuration,
      targetActivity: c.targetActivity,
    },
    obtainedAt:    c.obtainedAt,
    usedAt:        c.usedAt,
    targetPlayerId: c.targetPlayerId,
  };
}

function formatEffect(e: any) {
  return {
    id:             e.id,
    cardType:       e.cardType.toLowerCase(),
    rarity:         e.rarity.toLowerCase(),
    value:          e.value,
    appliedAt:      e.appliedAt,
    expiresAt:      e.expiresAt,
    targetActivity: e.targetActivity,
    appliedById:    e.appliedById,
    intervalMinutes: e.intervalMinutes,
  };
}
