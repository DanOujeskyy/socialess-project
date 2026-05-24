import { api, saveTokens, clearTokens } from './api';
import type { User, AuthTokens } from '../types';

interface LoginPayload  { email: string; password: string }
interface RegisterPayload { email: string; username: string; password: string }

export const authService = {
  async login(payload: LoginPayload): Promise<{ user: User; tokens: AuthTokens }> {
    const { data } = await api.post<{ user: User; tokens: AuthTokens }>('/auth/login', payload);
    await saveTokens(data.tokens.accessToken, data.tokens.refreshToken);
    return data;
  },

  async register(payload: RegisterPayload): Promise<{ user: User; tokens: AuthTokens }> {
    const { data } = await api.post<{ user: User; tokens: AuthTokens }>('/auth/register', payload);
    await saveTokens(data.tokens.accessToken, data.tokens.refreshToken);
    return data;
  },

  async logout(): Promise<void> {
    try { await api.post('/auth/logout'); } catch { /* ignore network error on logout */ }
    await clearTokens();
  },

  async getMe(): Promise<User> {
    const { data } = await api.get<User>('/auth/me');
    return data;
  },

  async updatePushToken(pushToken: string): Promise<void> {
    await api.patch('/auth/push-token', { pushToken });
  },
};
