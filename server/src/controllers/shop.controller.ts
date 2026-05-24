import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware';
import { AppError } from '../middleware/error.middleware';

const SHOP_ITEMS = [
  { id: 'time_30min',     type: 'time',  name: '+30 Minutes',   description: 'One-time time boost',     price: 0.99, currency: 'usd', valueSeconds: 1800, limitPerDay: 3 },
  { id: 'time_60min',     type: 'time',  name: '+60 Minutes',   description: 'Large time boost',        price: 1.99, currency: 'usd', valueSeconds: 3600, limitPerDay: 1 },
  { id: 'crate_premium',  type: 'crate', name: 'Premium Crate', description: 'Higher legendary chance', price: 1.99, currency: 'usd', limitPerDay: 1 },
  { id: 'card_epic',      type: 'card',  name: 'Epic Card',     description: 'Choose any epic card',    price: 2.99, currency: 'usd', rarity: 'epic',      limitPerDay: 1 },
];

export async function getShopItems(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.json(SHOP_ITEMS);
  } catch (err) { next(err); }
}

export async function purchaseItem(req: AuthRequest, res: Response, next: NextFunction) {
  // Stub — real implementation integrates with RevenueCat / Stripe
  next(new AppError('In-app purchases not yet enabled', 501));
}
