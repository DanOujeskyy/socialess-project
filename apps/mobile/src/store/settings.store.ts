import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SocialApp } from '../types';
import { DAILY_FREE_TIME_SECONDS } from '../constants';

// ── Goals defaults ────────────────────────────────────────────────────────────

export const DEFAULT_GOALS = {
  dailyTimeLimitSeconds: DAILY_FREE_TIME_SECONDS, // 15 min
  stepsGoal:  10_000,
  clicksGoal: 50,
  squatsGoal: 30,
} as const;

export interface Goals {
  dailyTimeLimitSeconds: number;
  stepsGoal:  number;
  clicksGoal: number;
  squatsGoal: number;
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface SettingsStore {
  // Tracked social apps
  trackedApps: Record<SocialApp, boolean>;

  // Notification preferences
  notificationsEnabled:  boolean;
  challengeNotifications: boolean;
  dailyRewardNotifications: boolean;

  // Personal goals
  goals: Goals;

  // Actions
  setTrackedApp: (app: SocialApp, enabled: boolean) => void;
  setNotificationsEnabled:  (v: boolean) => void;
  setChallengeNotifications: (v: boolean) => void;
  setDailyRewardNotifications: (v: boolean) => void;
  setGoal: <K extends keyof Goals>(key: K, value: Goals[K]) => void;
  resetGoals: () => void;
  getTrackedAppList: () => SocialApp[];
}

const ALL_APPS: Record<SocialApp, boolean> = {
  instagram: true,
  youtube:   true,
  snapchat:  true,
  tiktok:    true,
  facebook:  true,
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      trackedApps: ALL_APPS,
      notificationsEnabled:     true,
      challengeNotifications:   true,
      dailyRewardNotifications: true,
      goals: { ...DEFAULT_GOALS },

      setTrackedApp: (app, enabled) =>
        set((s) => ({ trackedApps: { ...s.trackedApps, [app]: enabled } })),

      setNotificationsEnabled:      (v) => set({ notificationsEnabled: v }),
      setChallengeNotifications:    (v) => set({ challengeNotifications: v }),
      setDailyRewardNotifications:  (v) => set({ dailyRewardNotifications: v }),

      setGoal: (key, value) =>
        set((s) => ({ goals: { ...s.goals, [key]: value } })),

      resetGoals: () => set({ goals: { ...DEFAULT_GOALS } }),

      getTrackedAppList: () => {
        const { trackedApps } = get();
        return (Object.keys(trackedApps) as SocialApp[]).filter((a) => trackedApps[a]);
      },
    }),
    {
      name:    'socialess-settings-v2',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
