import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../theme';
import { CARD_NAMES, CARD_DESCRIPTIONS, CARD_VALUES } from '../../constants';
import { RarityBadge } from './RarityBadge';
import type { GameCard } from '../../types';

const CARD_ICONS: Record<string, string> = {
  nerf_activities:          '📉',
  buff_activities:          '📈',
  ban_activity:             '🚫',
  limit_time_capacity:      '📦',
  reduce_time:              '⏳',
  increase_time:            '⏰',
  reduce_time_frequently:   '🔻',
  increase_time_frequently: '🔺',
  more_game_cards:          '🃏',
};

interface GameCardItemProps {
  card: GameCard;
  onPress?: (card: GameCard) => void;
  isUsed?: boolean;
  style?: ViewStyle;
  compact?: boolean;
}

export function GameCardItem({ card, onPress, isUsed, style, compact }: GameCardItemProps) {
  const gradient = Colors.rarityGradient[card.rarity] as [string, string];
  const rarityColor = Colors.rarity[card.rarity];
  const value = CARD_VALUES[card.type][card.rarity];
  const description = CARD_DESCRIPTIONS[card.type]
    .replace('{value}', String(value));

  return (
    <TouchableOpacity
      onPress={() => !isUsed && onPress?.(card)}
      activeOpacity={0.8}
      style={[styles.container, isUsed && styles.used, style]}
    >
      <LinearGradient
        colors={gradient}
        style={[styles.gradient, compact && styles.compact]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={[styles.glowBorder, { borderColor: rarityColor + '55' }]} />

        <View style={styles.header}>
          <Text style={styles.icon}>{CARD_ICONS[card.type] ?? '🎴'}</Text>
          <RarityBadge rarity={card.rarity} size="sm" />
        </View>

        <Text style={styles.name} numberOfLines={1}>
          {CARD_NAMES[card.type]}
        </Text>

        {!compact && (
          <Text style={styles.description} numberOfLines={2}>
            {description}
          </Text>
        )}

        {isUsed && (
          <View style={styles.usedOverlay}>
            <Text style={styles.usedText}>USED</Text>
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
  used: { opacity: 0.45 },
  gradient: {
    padding: Spacing.md,
    minHeight: 130,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: 'transparent',
    position: 'relative',
  },
  compact: { minHeight: 90, padding: Spacing.sm },
  glowBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  icon: { fontSize: 24 },
  name: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  description: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  usedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.xl,
  },
  usedText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.heavy,
    color: Colors.textMuted,
    letterSpacing: 2,
  },
});
