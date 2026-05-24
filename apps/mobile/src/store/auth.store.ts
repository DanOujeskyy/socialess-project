import { create } from 'zustand';
import type { User, AuthTokens } from '../types';
import { authService } from '../services/auth.service';
import { clearTokens, getAccessToken } from '../services/api';

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { user } = await authService.login({ email, password });
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      set({ error: err?.response?.data?.message ?? 'Login failed', isLoading: false });
      throw err;
    }
  },

  register: async (email, username, password) => {
    set({ isLoading: true, error: null });
    try {
      const { user } = await authService.register({ email, username, password });
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      set({ error: err?.response?.data?.message ?? 'Registration failed', isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    await authService.logout();
    set({ user: null, isAuthenticated: false });
  },

  loadUser: async () => {
    set({ isLoading: true });
    try {
      const token = await getAccessToken();
      if (!token) { set({ isLoading: false }); return; }
      const user = await authService.getMe();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      await clearTokens();
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  updateUser: (updates) =>
    set((state) => ({ user: state.user ? { ...state.user, ...updates } : null })),

  clearError: () => set({ error: null }),
}));
