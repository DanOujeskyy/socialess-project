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

export const SPIN_WHEEL_WEIGHTS = [
  { type: 'extra_spin', weight: 15 },
  { type: 'crate_basic',  weight: 25 },
  { type: 'time_300',   weight: 30 },
  { type: 'time_600',   weight: 15 },
  { type: 'card',       weight: 10 },
  { type: 'crate_premium', weight: 5 },
];
