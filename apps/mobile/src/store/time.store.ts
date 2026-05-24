import { create } from 'zustand';
import type { ActiveEffect, DailyStats } from '../types';
import {
  DAILY_FREE_TIME_SECONDS,
  DEFAULT_MAX_TIME_SECONDS,
  BASE_ACTIVITY_RATES,
} from '../constants';

interface TimeStore {
  currentTime: number; // seconds
  maxTime: number; // seconds
  activeEffects: ActiveEffect[];
  dailyStats: DailyStats;
  streak: number;
  isSocialActive: boolean;
  activeSocialApp: string | null;
  socialStartTime: number | null;

  setCurrentTime: (seconds: number) => void;
  setMaxTime: (seconds: number) => void;
  addTime: (seconds: number) => void;
  consumeTime: (seconds: number) => void;
  setActiveEffects: (effects: ActiveEffect[]) => void;
  addActiveEffect: (effect: ActiveEffect) => void;
  removeActiveEffect: (effectId: string) => void;
  setDailyStats: (stats: DailyStats) => void;
  incrementClicks: (count: number) => void;
  incrementSquats: (count: number) => void;
  updateSteps: (steps: number) => void;
  setStreak: (streak: number) => void;
  startSocialUsage: (app: string) => void;
  stopSocialUsage: () => number;
  getEffectiveActivityRate: (activity: 'clicks' | 'squats' | 'stepsPerThousand') => number;
  getEffectiveMaxTime: () => number;
  isBanned: (activity: 'clicks' | 'squats' | 'steps') => boolean;
}

export const useTimeStore = create<TimeStore>((set, get) => ({
  currentTime: DAILY_FREE_TIME_SECONDS,
  maxTime: DEFAULT_MAX_TIME_SECONDS,
  activeEffects: [],
  dailyStats: {
    date: '',
    clicks: 0,
    squats: 0,
    steps: 0,
    timeEarned: 0,
    timeUsed: 0,
  },
  streak: 0,
  isSocialActive: false,
  activeSocialApp: null,
  socialStartTime: null,

  setCurrentTime: (seconds) => set({ currentTime: Math.max(0, seconds) }),

  setMaxTime: (seconds) => set({ maxTime: seconds }),

  addTime: (seconds) =>
    set((state) => ({
      currentTime: Math.min(state.currentTime + seconds, get().getEffectiveMaxTime()),
    })),

  consumeTime: (seconds) =>
    set((state) => ({ currentTime: state.currentTime - seconds })),

  setActiveEffects: (effects) => set({ activeEffects: effects }),

  addActiveEffect: (effect) =>
    set((state) => ({ activeEffects: [...state.activeEffects, effect] })),

  removeActiveEffect: (effectId) =>
    set((state) => ({
      activeEffects: state.activeEffects.filter((e) => e.id !== effectId),
    })),

  setDailyStats: (stats) => set({ dailyStats: stats }),

  incrementClicks: (count) =>
    set((state) => ({
      dailyStats: { ...state.dailyStats, clicks: state.dailyStats.clicks + count },
    })),

  incrementSquats: (count) =>
    set((state) => ({
      dailyStats: { ...state.dailyStats, squats: state.dailyStats.squats + count },
    })),

  updateSteps: (steps) =>
    set((state) => ({ dailyStats: { ...state.dailyStats, steps } })),

  setStreak: (streak) => set({ streak }),

  startSocialUsage: (app) =>
    set({ isSocialActive: true, activeSocialApp: app, socialStartTime: Date.now() }),

  stopSocialUsage: () => {
    const state = get();
    if (!state.socialStartTime) return 0;
    const elapsed = Math.floor((Date.now() - state.socialStartTime) / 1000);
    set({ isSocialActive: false, activeSocialApp: null, socialStartTime: null });
    return elapsed;
  },

  getEffectiveActivityRate: (activity) => {
    const base = BASE_ACTIVITY_RATES[activity];
    const { activeEffects } = get();
    let multiplier = 1;
    for (const effect of activeEffects) {
      if (effect.cardType === 'nerf_activities') multiplier -= effect.value / 100;
      if (effect.cardType === 'buff_activities') multiplier += effect.value / 100;
    }
    return base * Math.max(0, multiplier);
  },

  getEffectiveMaxTime: () => {
    const { maxTime, activeEffects } = get();
    let reduction = 0;
    for (const effect of activeEffects) {
      if (effect.cardType === 'limit_time_capacity') reduction += effect.value;
    }
    return maxTime * (1 - reduction / 100);
  },

  isBanned: (activity) => {
    const { activeEffects } = get();
    const now = new Date();
    return activeEffects.some(
      (e) =>
        e.cardType === 'ban_activity' &&
        e.targetActivity === activity &&
        (!e.expiresAt || new Date(e.expiresAt) > now),
    );
  },
}));
