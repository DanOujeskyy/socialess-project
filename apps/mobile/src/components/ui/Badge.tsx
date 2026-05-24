import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../theme';

interface BadgeProps {
  label: string;
  color?: string;
  textColor?: string;
  size?: 'sm' | 'md';
}

export function Badge({ label, color = Colors.primary, textColor = Colors.text, size = 'md' }: BadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: color + '33' }, size === 'sm' && styles.sm]}>
      <Text style={[styles.label, { color }, size === 'sm' && styles.labelSm]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  sm: { paddingHorizontal: 6, paddingVertical: 2 },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, textTransform: 'uppercase', letterSpacing: 0.5 },
  labelSm: { fontSize: FontSize.xs },
});
