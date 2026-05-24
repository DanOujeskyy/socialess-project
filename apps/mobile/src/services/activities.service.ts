import { api } from './api';
import type { DailyStats } from '../types';

interface ActivityResult {
  secondsAdded: number;
  currentTime: number;
  dailyStats: DailyStats;
}

export const activitiesService = {
  async recordClicks(count: number): Promise<ActivityResult> {
    const { data } = await api.post<ActivityResult>('/activities/clicks', { count });
    return data;
  },

  async recordSquats(count: number): Promise<ActivityResult> {
    const { data } = await api.post<ActivityResult>('/activities/squats', { count });
    return data;
  },

  async recordSteps(steps: number): Promise<ActivityResult> {
    const { data } = await api.post<ActivityResult>('/activities/steps', { steps });
    return data;
  },

  async getDailyStats(): Promise<DailyStats> {
    const { data } = await api.get<DailyStats>('/activities/stats');
    return data;
  },

  async logSocialMediaUsage(app: string, seconds: number): Promise<{ currentTime: number }> {
    const { data } = await api.post<{ currentTime: number }>('/activities/social-usage', { app, seconds });
    return data;
  },
};
