export type Rarity   = 'common' | 'rare' | 'epic' | 'legendary';
export type CardType =
  | 'nerf_activities'
  | 'buff_activities'
  | 'ban_activity'
  | 'limit_time_capacity'
  | 'reduce_time'
  | 'increase_time'
  | 'reduce_time_frequently'
  | 'increase_time_frequently'
  | 'more_game_cards';

export type GameMode       = 'singleplayer' | 'multiplayer' | 'custom';
export type ChallengeStatus = 'lobby' | 'active' | 'ended';

export function prismaRarityToLocal(r: string): Rarity {
  return r.toLowerCase() as Rarity;
}

export function prismaCardTypeToLocal(t: string): CardType {
  return t.toLowerCase() as CardType;
}

export function localRarityToPrisma(r: Rarity): string {
  return r.toUpperCase();
}

export function localCardTypeToPrisma(t: CardType): string {
  return t.toUpperCase();
}
