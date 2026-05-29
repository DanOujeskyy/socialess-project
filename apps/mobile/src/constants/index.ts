import type { Rarity, CardType, EventCardType, GameCardType, PassReward } from '../types';

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
  reduce_time_frequently:   'Reduce Hourly',
  increase_time_frequently: 'Increase Hourly',
  more_game_cards:          'More Cards',
};

// Descriptions shown on game cards — always target a specific opponent.
export const CARD_DESCRIPTIONS: Record<GameCardType, string> = {
  nerf_activities:          'Target player earns less time from all physical activities.',
  buff_activities:          'Target player earns more time from all physical activities.',
  ban_activity:             'Target player cannot use the chosen activity to earn time for the duration.',
  limit_time_capacity:      "Target player's maximum time capacity is reduced.",
  reduce_time:              'Target player loses time instantly. Can go into negative.',
  increase_time:            'Target player gains time instantly. Cannot exceed max capacity.',
  reduce_time_frequently:   'Target player loses time every hour.',
  increase_time_frequently: 'Target player gains time every hour.',
};

// Descriptions shown on event cards — applied automatically to all players.
export const EVENT_CARD_DESCRIPTIONS: Record<EventCardType, string> = {
  nerf_activities:          'All players earn less time from physical activities.',
  buff_activities:          'All players earn more time from physical activities.',
  ban_activity:             'All players cannot use the chosen activity to earn time for the duration.',
  limit_time_capacity:      "All players' maximum time capacity is reduced.",
  reduce_time:              'All players lose time instantly. Can go into negative.',
  increase_time:            'All players gain time instantly. Cannot exceed max capacity.',
  reduce_time_frequently:   'All players lose time every hour.',
  increase_time_frequently: 'All players gain time every hour.',
  more_game_cards:          'All players receive additional game cards (multiplayer only).',
};

export const CARD_VAL_LABELS: Record<CardType, string> = {
  ban_activity:             'Duration',
  nerf_activities:          'Penalty',
  buff_activities:          'Bonus',
  reduce_time:              'Lost',
  increase_time:            'Gained',
  limit_time_capacity:      'Cap Reduction',
  reduce_time_frequently:   'Per Hour',
  increase_time_frequently: 'Per Hour',
  more_game_cards:          'Cards',
};

export const SOCIAL_APPS_CONFIG = {
  instagram: { name: 'Instagram', color: '#E1306C' },
  youtube:   { name: 'YouTube',   color: '#FF0000' },
  snapchat:  { name: 'Snapchat',  color: '#FFFC00' },
  tiktok:    { name: 'TikTok',    color: '#69C9D0' },
  facebook:  { name: 'Facebook',  color: '#1877F2' },
} as const;

// Native app deeplinks — opened via Linking.openURL when the app is installed.
// iOS requires each scheme to be listed in LSApplicationQueriesSchemes (app.json).
export const SOCIAL_APP_DEEPLINKS: Record<string, string> = {
  instagram: 'instagram://feed',
  youtube:   'youtube://',
  snapchat:  'snapchat://',
  tiktok:    'tiktok://foryou',
  facebook:  'fb://',
};

// Web fallback — used when the native app is not installed.
export const SOCIAL_APP_WEB_URLS: Record<string, string> = {
  instagram: 'https://www.instagram.com',
  youtube:   'https://www.youtube.com',
  snapchat:  'https://www.snapchat.com',
  tiktok:    'https://www.tiktok.com',
  facebook:  'https://www.facebook.com',
};

export const SPIN_WHEEL_ITEMS = [
  { type: 'time'       as const, label: '+10 Min',        color: '#10B981', weight: 25, value: 600  },
  { type: 'crate'      as const, label: 'Basic Crate',    color: '#4F46E5', weight: 20              },
  { type: 'time'       as const, label: '+5 Min',         color: '#059669', weight: 20, value: 300  },
  { type: 'card'       as const, label: 'Random Card',    color: '#2563EB', weight: 18              },
  { type: 'extra_spin' as const, label: 'Extra Spin',     color: '#7C3AED', weight: 8               },
  { type: 'crate'      as const, label: 'Premium Crate',  color: '#D97706', weight: 9               },
];

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
export const SOCKET_URL   = process.env.EXPO_PUBLIC_SOCKET_URL ?? 'http://localhost:3000';

// ── Rank Tiers ─────────────────────────────────────────────────────────────────

import type { RankTier } from '../types';

export const RANK_TIER_CONFIG: Record<RankTier, {
  label: string; icon: string; color: string; bg: string; minPoints: number; maxPoints: number | null;
}> = {
  bronze:   { label: 'Bronze',   icon: '🥉', color: '#CD7F32', bg: '#3B1F0A', minPoints: 0,    maxPoints: 499  },
  silver:   { label: 'Silver',   icon: '🥈', color: '#9CA3AF', bg: '#1E2330', minPoints: 500,  maxPoints: 1499 },
  gold:     { label: 'Gold',     icon: '🥇', color: '#F59E0B', bg: '#2A1F00', minPoints: 1500, maxPoints: 2999 },
  platinum: { label: 'Platinum', icon: '💎', color: '#60A5FA', bg: '#0C1E3A', minPoints: 3000, maxPoints: 4999 },
  diamond:  { label: 'Diamond',  icon: '💠', color: '#A855F7', bg: '#1A0B32', minPoints: 5000, maxPoints: null },
};

export function getTierProgress(rankPoints: number, tier: RankTier): number {
  const config = RANK_TIER_CONFIG[tier];
  if (config.maxPoints === null) return 1;
  const range = config.maxPoints - config.minPoints + 1;
  const progress = rankPoints - config.minPoints;
  return Math.max(0, Math.min(1, progress / range));
}

// Settings options for the lobby
export const STARTING_TIME_OPTIONS = [
  { label: '15 min',  value: 900  },
  { label: '30 min',  value: 1800 },
  { label: '1 hour',  value: 3600 },
  { label: '2 hours', value: 7200 },
];

export const STARTING_CARDS_OPTIONS = [
  { label: 'No cards', value: 0 },
  { label: '1 card',   value: 1 },
  { label: '2 cards',  value: 2 },
  { label: '3 cards',  value: 3 },
];

export const MAX_CARDS_PER_PLAYER = 6;

// Placement labels for penalty editor (placements 2-5)
export const PLACEMENT_LABELS: Record<number, string> = {
  2: '🥈 2nd place',
  3: '🥉 3rd place',
  4: '4th place',
  5: '5th place',
};

// ── Daily Pass ─────────────────────────────────────────────────────────────────

export const PASS_MONTHLY_PRICE = '€3.99';

export const PASS_REWARDS: PassReward[] = [
  // ── Week 1 — modest start ────────────────────────────────────────────────
  { day:  1, kind: 'time',  icon: '⚡', label: '+10m',  sublabel: '+10 Minutes',   color: '#10B981', seconds: 600  },
  { day:  2, kind: 'card',  icon: '⚪', label: 'Common', sublabel: 'Common Card',  color: '#6B7280', rarity: 'common'  },
  { day:  3, kind: 'time',  icon: '⚡', label: '+15m',  sublabel: '+15 Minutes',   color: '#10B981', seconds: 900  },
  { day:  4, kind: 'card',  icon: '⚪', label: 'Common', sublabel: 'Common Card',  color: '#6B7280', rarity: 'common'  },
  { day:  5, kind: 'time',  icon: '⏰', label: '+20m',  sublabel: '+20 Minutes',   color: '#10B981', seconds: 1200 },
  { day:  6, kind: 'card',  icon: '🔵', label: 'Rare',  sublabel: 'Rare Card',     color: '#3B82F6', rarity: 'rare'    },
  { day:  7, kind: 'crate', icon: '📦', label: 'Basic', sublabel: 'Basic Crate',   color: '#4F46E5', crateType: 'basic'  },
  // ── Week 2 — ramping up ──────────────────────────────────────────────────
  { day:  8, kind: 'time',  icon: '⏰', label: '+20m',  sublabel: '+20 Minutes',   color: '#10B981', seconds: 1200 },
  { day:  9, kind: 'card',  icon: '🔵', label: 'Rare',  sublabel: 'Rare Card',     color: '#3B82F6', rarity: 'rare'    },
  { day: 10, kind: 'time',  icon: '⏰', label: '+30m',  sublabel: '+30 Minutes',   color: '#059669', seconds: 1800 },
  { day: 11, kind: 'card',  icon: '🔵', label: 'Rare',  sublabel: 'Rare Card',     color: '#3B82F6', rarity: 'rare'    },
  { day: 12, kind: 'time',  icon: '⏰', label: '+30m',  sublabel: '+30 Minutes',   color: '#059669', seconds: 1800 },
  { day: 13, kind: 'card',  icon: '🟣', label: 'Epic',  sublabel: 'Epic Card',     color: '#A855F7', rarity: 'epic'    },
  { day: 14, kind: 'crate', icon: '📦', label: 'Basic', sublabel: 'Basic Crate',   color: '#4F46E5', crateType: 'basic'  },
  // ── Week 3 — getting good ────────────────────────────────────────────────
  { day: 15, kind: 'time',  icon: '⏰', label: '+30m',  sublabel: '+30 Minutes',   color: '#059669', seconds: 1800 },
  { day: 16, kind: 'card',  icon: '🟣', label: 'Epic',  sublabel: 'Epic Card',     color: '#A855F7', rarity: 'epic'    },
  { day: 17, kind: 'time',  icon: '🕰️', label: '+45m',  sublabel: '+45 Minutes',   color: '#F59E0B', seconds: 2700 },
  { day: 18, kind: 'card',  icon: '🔵', label: 'Rare',  sublabel: 'Rare Card',     color: '#3B82F6', rarity: 'rare'    },
  { day: 19, kind: 'time',  icon: '🕰️', label: '+45m',  sublabel: '+45 Minutes',   color: '#F59E0B', seconds: 2700 },
  { day: 20, kind: 'card',  icon: '🟣', label: 'Epic',  sublabel: 'Epic Card',     color: '#A855F7', rarity: 'epic'    },
  { day: 21, kind: 'crate', icon: '💎', label: 'Premium', sublabel: 'Premium Crate', color: '#D97706', crateType: 'premium' },
  // ── Week 4 — premium rewards ─────────────────────────────────────────────
  { day: 22, kind: 'time',  icon: '🕰️', label: '+30m',  sublabel: '+30 Minutes',   color: '#059669', seconds: 1800 },
  { day: 23, kind: 'card',  icon: '🟣', label: 'Epic',  sublabel: 'Epic Card',     color: '#A855F7', rarity: 'epic'    },
  { day: 24, kind: 'time',  icon: '🕰️', label: '+1h',   sublabel: '+1 Hour',       color: '#E17055', seconds: 3600 },
  { day: 25, kind: 'card',  icon: '🔵', label: 'Rare',  sublabel: 'Rare Card',     color: '#3B82F6', rarity: 'rare'    },
  { day: 26, kind: 'time',  icon: '🕰️', label: '+1h',   sublabel: '+1 Hour',       color: '#E17055', seconds: 3600 },
  { day: 27, kind: 'card',  icon: '🟣', label: 'Epic',  sublabel: 'Epic Card',     color: '#A855F7', rarity: 'epic'    },
  { day: 28, kind: 'crate', icon: '💎', label: 'Premium', sublabel: 'Premium Crate', color: '#D97706', crateType: 'premium' },
  { day: 29, kind: 'time',  icon: '🕰️', label: '+1h',   sublabel: '+1 Hour',       color: '#E17055', seconds: 3600 },
  // ── Day 30 — legendary finale ─────────────────────────────────────────────
  { day: 30, kind: 'card',  icon: '👑', label: 'Legend', sublabel: 'Legendary Card', color: '#F59E0B', rarity: 'legendary' },
];
