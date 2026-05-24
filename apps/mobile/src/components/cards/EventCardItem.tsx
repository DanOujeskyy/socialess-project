import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../theme';
import { CARD_NAMES, CARD_DESCRIPTIONS, CARD_VALUES } from '../../constants';
import { RarityBadge } from './RarityBadge';
import type { EventCard } from '../../types';
import { formatDistanceToNow } from 'date-fns';

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

interface EventCardItemProps {
  card: EventCard;
  style?: ViewStyle;
}

export function EventCardItem({ card, style }: EventCardItemProps) {
  const gradient = Colors.rarityGradient[card.rarity] as [string, string];
  const rarityColor = Colors.rarity[card.rarity];
  const value = CARD_VALUES[card.type][card.rarity];
  const description = CARD_DESCRIPTIONS[card.type].replace('{value}', String(value));

  const expiresLabel = card.activeUntil
    ? `Expires ${formatDistanceToNow(new Date(card.activeUntil), { addSuffix: true })}`
    : 'Active today';

  return (
    <LinearGradient
      colors={gradient}
      style={[styles.container, { borderColor: rarityColor + '44' }, style]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={styles.topRow}>
        <View style={styles.badgeRow}>
          <View style={styles.eventBadge}>
            <Text style={styles.eventLabel}>EVENT</Text>
          </View>
          <RarityBadge rarity={card.rarity} size="sm" />
        </View>
        <Text style={styles.icon}>{CARD_ICONS[card.type] ?? '🎴'}</Text>
      </View>

      <Text style={styles.name}>{CARD_NAMES[card.type]}</Text>
      <Text style={styles.description}>{description}</Text>

      <View style={styles.footer}>
        <View style={[styles.activeDot, { backgroundColor: card.isActive ? Colors.success : Colors.textMuted }]} />
        <Text style={styles.expires}>{expiresLabel}</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Radius.xl,
    padding: Spacing.base,
    borderWidth: 1.5,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  badgeRow: { flexDirection: 'row', gap: Spacing.xs },
  eventBadge: {
    backgroundColor: Colors.warning + '22',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.warning + '44',
  },
  eventLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.warning,
    letterSpacing: 0.8,
  },
  icon: { fontSize: 26 },
  name: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  description: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  activeDot: { width: 7, height: 7, borderRadius: 4 },
  expires: { fontSize: FontSize.xs, color: Colors.textMuted },
});
