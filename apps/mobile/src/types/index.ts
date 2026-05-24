export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type GameMode = 'singleplayer' | 'multiplayer' | 'custom';
export type ActivityType = 'clicks' | 'squats' | 'steps';
export type SocialApp = 'instagram' | 'youtube' | 'snapchat' | 'tiktok' | 'facebook';
export type ChallengeStatus = 'lobby' | 'active' | 'ended';

export type CardType =
  | 'nerf_activities'
  | 'buff_activities'
  | 'ban_activity'
  | 'limit_time_capacity'
  | 'reduce_time'
  | 'increase_time'
  | 'reduce_time_frequently'
  | 'increase_time_frequently'
  | 'more_game_cards';

export interface CardEffect {
  type: CardType;
  rarity: Rarity;
  value: number;
  duration?: number; // hours
  targetActivity?: ActivityType;
}

export interface GameCard {
  id: string;
  type: CardType;
  rarity: Rarity;
  effect: CardEffect;
  obtainedAt: string;
  usedAt?: string;
  targetPlayerId?: string;
}

export interface EventCard {
  id: string;
  type: CardType;
  rarity: Rarity;
  effect: CardEffect;
  date: string;
  activeUntil?: string;
  isActive: boolean;
}

export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  level: number;
  totalStreak: number;
  currentStreak: number;
  lastActiveDate: string;
  createdAt: string;
  gems: number;
}

export interface ActiveEffect {
  id: string;
  cardType: CardType;
  rarity: Rarity;
  value: number;
  appliedAt: string;
  expiresAt?: string;
  targetActivity?: ActivityType;
  appliedById?: string;
  intervalMinutes?: number;
  lastAppliedAt?: string;
}

export interface DailyStats {
  date: string;
  clicks: number;
  squats: number;
  steps: number;
  timeEarned: number; // seconds
  timeUsed: number; // seconds
}

export interface PlayerState {
  userId: string;
  username: string;
  avatar?: string;
  currentTime: number; // seconds
  maxTime: number; // seconds
  activeEffects: ActiveEffect[];
  cards: GameCard[];
  dailyStats: DailyStats;
  streak: number;
  isEliminated: boolean;
}

export interface ChallengeSettings {
  startingTime: number; // seconds
  maxTime: number; // seconds
  enabledCardTypes: CardType[];
  trackedApps: SocialApp[];
  activityRates: {
    clicks: number; // seconds per click
    squats: number; // seconds per squat
    stepsPerThousand: number; // seconds per 1000 steps
  };
  penalties?: string;
}

export interface Challenge {
  id: string;
  code: string;
  mode: GameMode;
  hostId: string;
  players: PlayerState[];
  status: ChallengeStatus;
  settings: ChallengeSettings;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
}

export interface Crate {
  id: string;
  type: 'basic' | 'premium' | 'ad';
  opened: boolean;
  openedAt?: string;
  reward?: GameCard;
}

export interface SpinReward {
  type: 'extra_spin' | 'crate' | 'time' | 'card';
  value: number | GameCard | null;
  label: string;
}

export interface ShopItem {
  id: string;
  type: 'time' | 'crate' | 'card';
  name: string;
  description: string;
  price: number;
  currency: 'usd' | 'gems';
  valueSeconds?: number;
  rarity?: Rarity;
  limitPerDay?: number;
  purchasedToday?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  message: string;
  code?: string;
  statusCode?: number;
}
