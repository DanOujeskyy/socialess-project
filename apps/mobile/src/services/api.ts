import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../constants';

const SECURE_STORE_KEY_ACCESS  = 'socialess_access_token';
const SECURE_STORE_KEY_REFRESH = 'socialess_refresh_token';

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await SecureStore.getItemAsync(SECURE_STORE_KEY_ACCESS);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = await SecureStore.getItemAsync(SECURE_STORE_KEY_REFRESH);
        if (!refreshToken) throw new Error('No refresh token');
        const { data } = await axios.post(`${API_BASE_URL}/api/auth/refresh`, { refreshToken });
        await saveTokens(data.accessToken, data.refreshToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        await clearTokens();
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  },
);

export async function saveTokens(accessToken: string, refreshToken: string) {
  await Promise.all([
    SecureStore.setItemAsync(SECURE_STORE_KEY_ACCESS,  accessToken),
    SecureStore.setItemAsync(SECURE_STORE_KEY_REFRESH, refreshToken),
  ]);
}

export async function clearTokens() {
  await Promise.all([
    SecureStore.deleteItemAsync(SECURE_STORE_KEY_ACCESS),
    SecureStore.deleteItemAsync(SECURE_STORE_KEY_REFRESH),
  ]);
}

export async function getAccessToken() {
  return SecureStore.getItemAsync(SECURE_STORE_KEY_ACCESS);
}
