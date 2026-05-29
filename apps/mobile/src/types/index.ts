export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type GameMode = 'singleplayer' | 'multiplayer' | 'ranked' | 'custom';
export type RankTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
export type MatchmakingStatus = 'idle' | 'queued' | 'matched' | 'cancelled';

export function isCompetitiveMode(mode: GameMode | null): boolean {
  return mode === 'multiplayer' || mode === 'ranked';
}
export type ActivityType = 'clicks' | 'squats' | 'steps';
export type SocialApp = 'instagram' | 'youtube' | 'snapchat' | 'tiktok' | 'facebook';
export type ChallengeStatus = 'lobby' | 'active' | 'ended';

// Event cards affect all players in the game (triggered automatically).
// more_game_cards is exclusive to event cards.
export type EventCardType =
  | 'nerf_activities'
  | 'buff_activities'
  | 'ban_activity'
  | 'limit_time_capacity'
  | 'reduce_time'
  | 'increase_time'
  | 'reduce_time_frequently'
  | 'increase_time_frequently'
  | 'more_game_cards';

// Game cards are used by a player against a specific target in multiplayer.
export type GameCardType = Exclude<EventCardType, 'more_game_cards'>;

// Full union kept for shared lookup tables (CARD_VALUES, CARD_NAMES, etc.)
export type CardType = EventCardType;

export interface CardEffect {
  type: CardType;
  rarity: Rarity;
  value: number;
  duration?: number; // hours
  targetActivity?: ActivityType;
}

// Held in a player's hand during an active multiplayer game.
// Cleared when the game ends (win or lose).
export interface GameCard {
  id: string;
  type: GameCardType;
  rarity: Rarity;
  effect: CardEffect;
  obtainedAt: string;
  usedAt?: string;
  targetPlayerId?: string;
}

// Applied automatically to all players by a game event.
export interface EventCard {
  id: string;
  type: EventCardType;
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
  placement?: number;
  pointsChange?: number;
  rankPoints?: number;
  rankTier?: RankTier;
}

// Penalty assigned to a specific placement (placement 1 = winner, never penalised)
export interface PenaltyRule {
  placement: number;   // 2, 3, 4, …
  description: string; // e.g. "50 push-ups"
}

export interface ChallengeSettings {
  startingTime: number; // seconds
  maxTime: number; // seconds
  startingCards: number; // cards per player at start (0-3)
  eliminationThreshold: number; // seconds; 0 = eliminated when time hits 0
  enabledCardTypes: CardType[];
  trackedApps: SocialApp[];
  activityRates: {
    clicks: number;
    squats: number;
    stepsPerThousand: number;
  };
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatar?: string;
  rankPoints: number;
  rankTier: RankTier;
  rankedWins: number;
  rankedLosses: number;
  level?: number;
  weeklyWins?: number;
}

export interface GamePlayerResult {
  userId: string;
  username: string;
  placement: number;
  currentTime: number;
  pointsChange: number | null;
  rankPoints: number;
  rankTier: RankTier;
}

export interface GameResults {
  challengeId: string;
  mode: GameMode;
  players: GamePlayerResult[];
  penalties?: PenaltyRule[] | null;
  endedAt: string;
}

export interface Challenge {
  id: string;
  code: string;
  mode: GameMode;
  hostId: string;
  players: PlayerState[];
  status: ChallengeStatus;
  settings: ChallengeSettings;
  penalties?: PenaltyRule[] | null; // placement-based penalties, stored as JSON string server-side
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

export interface PassReward {
  day:        number;
  kind:       'time' | 'card' | 'crate';
  icon:       string;
  label:      string;      // short display  e.g. "+10m", "Rare", "Basic"
  sublabel:   string;      // full display   e.g. "+10 Minutes", "Rare Card", "Basic Crate"
  color:      string;
  seconds?:   number;      // for kind === 'time'
  rarity?:    Rarity;      // for kind === 'card'
  crateType?: 'basic' | 'premium'; // for kind === 'crate'
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
