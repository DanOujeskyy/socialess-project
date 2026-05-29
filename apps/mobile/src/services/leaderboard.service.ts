import { api } from './api';
import type { LeaderboardEntry } from '../types';

interface MyRankResponse {
  me: LeaderboardEntry & { rankedWins: number; rankedLosses: number };
  surrounding: LeaderboardEntry[];
}

export const leaderboardService = {
  async getGlobal(): Promise<LeaderboardEntry[]> {
    const { data } = await api.get<LeaderboardEntry[]>('/leaderboard/global');
    return data;
  },

  async getMyRank(): Promise<MyRankResponse> {
    const { data } = await api.get<MyRankResponse>('/leaderboard/me');
    return data;
  },
};
