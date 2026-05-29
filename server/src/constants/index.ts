import type { Rarity, CardType } from '../types';

export const DAILY_FREE_TIME_SECONDS  = 15 * 60;
export const DEFAULT_MAX_TIME_SECONDS = 100 * 60;

export const BASE_ACTIVITY_RATES = {
  clicks:          15,
  squats:          10,
  stepsPerThousand: 90,
} as const;

export const CARD_VALUES: Record<CardType, Record<Rarity, number>> = {
  nerf_activities:          { common: 20, rare: 30, epic: 50, legendary: 70 },
  buff_activities:          { common: 20, rare: 30, epic: 50, legendary: 70 },
  ban_activity:             { common: 6,  rare: 12, epic: 24, legendary: 48 },
  limit_time_capacity:      { common: 20, rare: 30, epic: 50, legendary: 70 },
  reduce_time:              { common: 10, rare: 15, epic: 20, legendary: 30 },
  increase_time:            { common: 10, rare: 15, epic: 20, legendary: 30 },
  reduce_time_frequently:   { common: 2,  rare: 5,  epic: 7,  legendary: 10 },
  increase_time_frequently: { common: 2,  rare: 5,  epic: 7,  legendary: 10 },
  more_game_cards:          { common: 1,  rare: 2,  epic: 3,  legendary: 4  },
};

export const RARITY_DROP_RATES: Record<Rarity, number> = {
  legendary: 0.03,
  epic:      0.12,
  rare:      0.25,
  common:    0.60,
};

export const ALL_CARD_TYPES: CardType[] = [
  'nerf_activities',
  'buff_activities',
  'ban_activity',
  'limit_time_capacity',
  'reduce_time',
  'increase_time',
  'reduce_time_frequently',
  'increase_time_frequently',
  'more_game_cards',
];

export const MAX_CARDS_FROM_OTHER_PLAYERS = 2;

// ── Rank System ────────────────────────────────────────────────────────────────

export const RANK_TIER_THRESHOLDS = {
  BRONZE:   0,
  SILVER:   500,
  GOLD:     1500,
  PLATINUM: 3000,
  DIAMOND:  5000,
} as const;

export function getTierFromPoints(points: number): string {
  if (points >= 5000) return 'DIAMOND';
  if (points >= 3000) return 'PLATINUM';
  if (points >= 1500) return 'GOLD';
  if (points >= 500)  return 'SILVER';
  return 'BRONZE';
}

export function calcRankedPoints(placement: number, _totalPlayers: number): number {
  // Designed for 10-player lobbies.
  // 5th place is the "break-even" point — no gain, no loss.
  if (placement === 1)  return  50;
  if (placement === 2)  return  30;
  if (placement === 3)  return  15;
  if (placement === 4)  return   5;
  if (placement === 5)  return   0;  // break-even
  if (placement <= 7)   return  -5;
  if (placement <= 9)   return -15;
  return -25; // 10th place
}

// Fixed settings for all ranked matches — ends when only 1 player remains
export const RANKED_SETTINGS = {
  startingTime:    15 * 60,
  maxTime:         100 * 60,
  startingCards:   1,
  eliminationThreshold: 0,
  enabledCardTypes: [
    'nerf_activities', 'buff_activities', 'ban_activity',
    'limit_time_capacity', 'reduce_time', 'increase_time',
    'reduce_time_frequently', 'increase_time_frequently',
  ],
  trackedApps: ['instagram', 'youtube', 'snapchat', 'tiktok', 'facebook'],
  activityRates: { clicks: 15, squats: 10, stepsPerThousand: 90 },
};

export const MAX_CARDS_PER_PLAYER  = 6;
export const RANKED_LOBBY_SIZE     = 10;   // players per ranked match
export const LOBBY_FILL_TIME_MS   = 30_000; // max wait before forcing bot fill

export const SPIN_WHEEL_WEIGHTS = [
  { type: 'extra_spin', weight: 15 },
  { type: 'crate_basic',  weight: 25 },
  { type: 'time_300',   weight: 30 },
  { type: 'time_600',   weight: 15 },
  { type: 'card',       weight: 10 },
  { type: 'crate_premium', weight: 5 },
];
