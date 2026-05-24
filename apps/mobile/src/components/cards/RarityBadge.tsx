import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../theme';
import type { Rarity } from '../../types';

const RARITY_LABELS: Record<Rarity, string> = {
  common:    'Common',
  rare:      'Rare',
  epic:      'Epic',
  legendary: 'Legendary',
};

interface RarityBadgeProps {
  rarity: Rarity;
  size?: 'sm' | 'md';
}

export function RarityBadge({ rarity, size = 'md' }: RarityBadgeProps) {
  const color = Colors.rarity[rarity];
  return (
    <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color + '55' }, size === 'sm' && styles.sm]}>
      <Text style={[styles.label, { color }, size === 'sm' && styles.labelSm]}>
        {RARITY_LABELS[rarity]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  sm: { paddingHorizontal: 6, paddingVertical: 2 },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  labelSm: { fontSize: FontSize.xs, letterSpacing: 0.5 },
});
