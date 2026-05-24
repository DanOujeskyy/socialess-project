import { api } from './api';
import type { GameCard, Crate, SpinReward } from '../types';

export const cardsService = {
  async getMyCards(): Promise<GameCard[]> {
    const { data } = await api.get<GameCard[]>('/cards');
    return data;
  },

  async useCard(cardId: string, targetPlayerId: string): Promise<void> {
    await api.post(`/cards/${cardId}/use`, { targetPlayerId });
  },

  async openCrate(crateId: string): Promise<GameCard> {
    const { data } = await api.post<GameCard>(`/crates/${crateId}/open`);
    return data;
  },

  async getMyCrates(): Promise<Crate[]> {
    const { data } = await api.get<Crate[]>('/crates');
    return data;
  },

  async claimAdCrate(): Promise<Crate> {
    const { data } = await api.post<Crate>('/crates/ad');
    return data;
  },

  async spinLuckyWheel(): Promise<SpinReward> {
    const { data } = await api.post<SpinReward>('/spin');
    return data;
  },

  async claimAdSpin(): Promise<{ canSpin: boolean }> {
    const { data } = await api.post<{ canSpin: boolean }>('/spin/ad');
    return data;
  },
};
