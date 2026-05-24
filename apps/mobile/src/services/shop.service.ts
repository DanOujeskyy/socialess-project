import { api } from './api';
import type { ShopItem } from '../types';

export const shopService = {
  async getShopItems(): Promise<ShopItem[]> {
    const { data } = await api.get<ShopItem[]>('/shop');
    return data;
  },

  async purchaseItem(itemId: string): Promise<{ success: boolean; message: string }> {
    const { data } = await api.post<{ success: boolean; message: string }>(`/shop/${itemId}/purchase`);
    return data;
  },
};
