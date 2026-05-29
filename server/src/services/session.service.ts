import { startOfDay } from 'date-fns';
import { prisma } from '../lib/prisma';
import {
  DAILY_FREE_TIME_SECONDS,
  DEFAULT_MAX_TIME_SECONDS,
  RARITY_DROP_RATES,
  ALL_CARD_TYPES,
  CARD_VALUES,
} from '../constants';
import type { Rarity, CardType } from '../types';

export async function getOrCreateTodaySession(userId: string) {
  const today = startOfDay(new Date());
  return prisma.playerSession.upsert({
    where:  { userId_date: { userId, date: today } },
    create: { userId, date: today, maxTime: DEFAULT_MAX_TIME_SECONDS },
    update: {},
    include: { activeEffects: true, eventCard: true },
  });
}

export async function claimDailyRewards(userId: string) {
  const today = startOfDay(new Date());
  const session = await getOrCreateTodaySession(userId);
  const results = { freeTimeAdded: false, crateAdded: false };

  if (!session.freeTimeGiven) {
    await prisma.playerSession.update({
      where: { id: session.id },
      data: {
        currentTime: Math.min(
          session.currentTime + DAILY_FREE_TIME_SECONDS,
          session.maxTime,
        ),
        freeTimeGiven: true,
        timeEarned: { increment: DAILY_FREE_TIME_SECONDS },
      },
    });
    results.freeTimeAdded = true;
  }

  if (!session.crateGiven) {
    await prisma.crate.create({ data: { userId, type: 'BASIC' } });
    await prisma.playerSession.update({
      where: { id: session.id },
      data: { crateGiven: true },
    });
    results.crateAdded = true;
  }

  // Update streak
  await updateStreak(userId);

  return results;
}

async function updateStreak(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  const today = startOfDay(new Date());
  const lastActive = user.lastActiveDate ? startOfDay(user.lastActiveDate) : null;

  if (!lastActive) {
    await prisma.user.update({
      where: { id: userId },
      data: { currentStreak: 1, totalStreak: 1, lastActiveDate: today },
    });
    return;
  }

  const dayDiff = Math.floor((today.getTime() - lastActive.getTime()) / 86400000);
  if (dayDiff === 0) return; // Already counted today
  if (dayDiff === 1) {
    const newStreak = user.currentStreak + 1;
    await prisma.user.update({
      where: { id: userId },
      data: {
        currentStreak: newStreak,
        totalStreak: Math.max(user.totalStreak, newStreak),
        lastActiveDate: today,
      },
    });
  } else {
    await prisma.user.update({
      where: { id: userId },
      data: { currentStreak: 1, lastActiveDate: today },
    });
  }
}

export function rollRarity(): Rarity {
  const rand = Math.random();
  if (rand < RARITY_DROP_RATES.legendary) return 'legendary';
  if (rand < RARITY_DROP_RATES.legendary + RARITY_DROP_RATES.epic) return 'epic';
  if (rand < RARITY_DROP_RATES.legendary + RARITY_DROP_RATES.epic + RARITY_DROP_RATES.rare) return 'rare';
  return 'common';
}

export function rollCardType(excludeMultiplayerOnly = false): CardType {
  const types = excludeMultiplayerOnly
    ? ALL_CARD_TYPES.filter((t) => t !== 'more_game_cards')
    : ALL_CARD_TYPES;
  return types[Math.floor(Math.random() * types.length)];
}

export async function generateEventCard(sessionId?: string, challengeId?: string) {
  const rarity  = rollRarity();
  const type    = rollCardType(!challengeId);
  const value   = CARD_VALUES[type][rarity];
  const today   = startOfDay(new Date());

  return prisma.eventCard.create({
    data: {
      sessionId,
      challengeId,
      date: today,
      type: type.toUpperCase() as any,
      rarity: rarity.toUpperCase() as any,
      effectValue: value,
      isActive: true,
      activeUntil: new Date(today.getTime() + 24 * 60 * 60 * 1000),
    },
  });
}
