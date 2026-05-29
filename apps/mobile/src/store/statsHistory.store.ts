import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DailyStats } from '../types';

export interface DailyRecord extends DailyStats {
  date: string; // YYYY-MM-DD
}

interface StatsHistoryStore {
  records: DailyRecord[];
  upsertToday: (stats: DailyStats) => void;
}

export const useStatsHistoryStore = create<StatsHistoryStore>()(
  persist(
    (set) => ({
      records: [],

      upsertToday: (stats) => {
        const date = new Date().toISOString().split('T')[0];
        set((state) => {
          const idx = state.records.findIndex((r) => r.date === date);
          const record: DailyRecord = { ...stats, date };
          if (idx >= 0) {
            const next = [...state.records];
            next[idx] = record;
            return { records: next };
          }
          // Keep 30 days, sorted chronologically
          const next = [...state.records, record]
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(-30);
          return { records: next };
        });
      },
    }),
    {
      name: 'socialess-stats-history-v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
