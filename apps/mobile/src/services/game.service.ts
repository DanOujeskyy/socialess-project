import { api } from './api';
import type {
  Challenge, ChallengeSettings, GameMode, PlayerState, EventCard,
} from '../types';


export const gameService = {
  async createChallenge(mode: GameMode, settings: Partial<ChallengeSettings>): Promise<Challenge> {
    const { data } = await api.post<Challenge>('/challenges', { mode, settings });
    return data;
  },

  async joinChallenge(code: string): Promise<Challenge> {
    const { data } = await api.post<Challenge>(`/challenges/join`, { code });
    return data;
  },

  async getChallenge(challengeId: string): Promise<Challenge> {
    const { data } = await api.get<Challenge>(`/challenges/${challengeId}`);
    return data;
  },

  async startChallenge(challengeId: string): Promise<Challenge> {
    const { data } = await api.post<Challenge>(`/challenges/${challengeId}/start`);
    return data;
  },

  async leaveChallenge(challengeId: string): Promise<void> {
    await api.post(`/challenges/${challengeId}/leave`);
  },

  async getMyPlayerState(): Promise<PlayerState> {
    const { data } = await api.get<PlayerState>('/session/state');
    return data;
  },

  async getTodaysEventCard(): Promise<EventCard | null> {
    const { data } = await api.get<EventCard | null>('/session/event-card');
    return data;
  },

  async getDailyRewards(): Promise<{ freeTimeAdded: boolean; crateAdded: boolean }> {
    const { data } = await api.post<{ freeTimeAdded: boolean; crateAdded: boolean }>('/session/daily-rewards');
    return data;
  },

  async updateChallengeSettings(
    challengeId: string,
    settings: Partial<ChallengeSettings>,
    penalties?: import('../types').PenaltyRule[],
  ): Promise<Challenge> {
    const { data } = await api.patch<Challenge>(`/challenges/${challengeId}/settings`, {
      settings,
      penalties: penalties ? JSON.stringify(penalties) : undefined,
    });
    return data;
  },

  async endChallenge(challengeId: string): Promise<void> {
    await api.post(`/challenges/${challengeId}/end`);
  },
};
