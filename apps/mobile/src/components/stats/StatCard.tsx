import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../theme';

interface StatCardProps {
  icon: string;
  label: string;
  value: string;
  subValue?: string;
  color?: string;
}

export function StatCard({ icon, label, value, subValue, color = Colors.primary }: StatCardProps) {
  return (
    <View style={[styles.card, { borderColor: color + '33' }]}>
      <View style={[styles.iconWrap, { backgroundColor: color + '22' }]}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color }]}>{value}</Text>
      {subValue && <Text style={styles.sub}>{subValue}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    gap: 4,
    flex: 1,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  icon: { fontSize: 22 },
  label: { fontSize: FontSize.xs, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  value: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  sub: { fontSize: FontSize.xs, color: Colors.textSecondary },
});
