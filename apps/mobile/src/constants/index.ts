import type { Rarity, CardType } from '../types';

export const DAILY_FREE_TIME_SECONDS = 15 * 60;
export const DEFAULT_MAX_TIME_SECONDS = 100 * 60;
export const TIME_WARNING_THRESHOLD_SECONDS = 5 * 60;
export const DAILY_RESET_HOUR = 4;
export const MAX_CARDS_FROM_OTHER_PLAYERS = 2;

export const BASE_ACTIVITY_RATES = {
  clicks: 15,
  squats: 10,
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
  common:    0.60,
  rare:      0.25,
  epic:      0.12,
  legendary: 0.03,
};

export const CARD_NAMES: Record<CardType, string> = {
  nerf_activities:          'Nerf Activities',
  buff_activities:          'Buff Activities',
  ban_activity:             'Ban Activity',
  limit_time_capacity:      'Limit Capacity',
  reduce_time:              'Reduce Time',
  increase_time:            'Increase Time',
  reduce_time_frequently:   'Time Drain',
  increase_time_frequently: 'Time Flow',
  more_game_cards:          'More Cards',
};

export const CARD_DESCRIPTIONS: Record<CardType, string> = {
  nerf_activities:          'Reduces time earned from activities by {value}%',
  buff_activities:          'Increases time earned from activities by {value}%',
  ban_activity:             'Prevents using a specific activity for {value} hours',
  limit_time_capacity:      'Reduces maximum time capacity by {value}%',
  reduce_time:              'Instantly removes {value} minutes of time',
  increase_time:            'Instantly adds {value} minutes of time',
  reduce_time_frequently:   'Drains {value} minutes every hour',
  increase_time_frequently: 'Adds {value} minutes every hour',
  more_game_cards:          'Grants {value} additional game cards',
};

export const SOCIAL_APPS_CONFIG = {
  instagram: { name: 'Instagram', color: '#E1306C' },
  youtube:   { name: 'YouTube',   color: '#FF0000' },
  snapchat:  { name: 'Snapchat',  color: '#FFFC00' },
  tiktok:    { name: 'TikTok',    color: '#69C9D0' },
  facebook:  { name: 'Facebook',  color: '#1877F2' },
} as const;

export const SPIN_WHEEL_ITEMS = [
  { type: 'extra_spin' as const, label: 'Extra Spin',     color: '#A855F7', weight: 15 },
  { type: 'crate' as const,      label: 'Basic Crate',    color: '#3B82F6', weight: 25 },
  { type: 'time' as const,       label: '+5 Min',         color: '#10B981', weight: 30, value: 300 },
  { type: 'time' as const,       label: '+10 Min',        color: '#059669', weight: 15, value: 600 },
  { type: 'card' as const,       label: 'Random Card',    color: '#F59E0B', weight: 10 },
  { type: 'crate' as const,      label: 'Premium Crate',  color: '#8B5CF6', weight: 5  },
];

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
export const SOCKET_URL   = process.env.EXPO_PUBLIC_SOCKET_URL ?? 'http://localhost:3000';
