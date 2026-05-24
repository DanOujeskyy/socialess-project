import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../theme';
import { useTimeStore } from '../../store/time.store';
import { Card } from '../ui/Card';

function formatSeconds(s: number): string {
  const m = Math.floor(Math.abs(s) / 60);
  const sec = Math.abs(s) % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

interface StatItemProps {
  icon: string;
  label: string;
  value: string;
  subLabel?: string;
}

function StatItem({ icon, label, value, subLabel }: StatItemProps) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {subLabel && <Text style={styles.statSub}>{subLabel}</Text>}
    </View>
  );
}

export function DailyStatsPanel() {
  const { dailyStats, streak } = useTimeStore();

  return (
    <Card>
      <Text style={styles.heading}>Today</Text>
      <View style={styles.grid}>
        <StatItem icon="👆" label="Clicks"  value={String(dailyStats.clicks)}  subLabel={`+${formatSeconds(dailyStats.clicks * 15)} earned`} />
        <StatItem icon="🏋️" label="Squats"  value={String(dailyStats.squats)}  subLabel={`+${formatSeconds(dailyStats.squats * 10)} earned`} />
        <StatItem icon="👟" label="Steps"   value={dailyStats.steps.toLocaleString()} subLabel={`+${formatSeconds(Math.floor(dailyStats.steps / 1000 * 90))} earned`} />
        <StatItem icon="🔥" label="Streak"  value={`${streak}d`} />
      </View>

      <View style={styles.divider} />
      <View style={styles.totalsRow}>
        <View style={styles.totalItem}>
          <Text style={styles.totalLabel}>Time Earned</Text>
          <Text style={[styles.totalValue, { color: Colors.success }]}>
            +{formatSeconds(dailyStats.timeEarned)}
          </Text>
        </View>
        <View style={styles.totalItem}>
          <Text style={styles.totalLabel}>Time Used</Text>
          <Text style={[styles.totalValue, { color: Colors.danger }]}>
            -{formatSeconds(dailyStats.timeUsed)}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: Spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  statItem: {
    flex: 1,
    minWidth: '40%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  statIcon: { fontSize: 20 },
  statValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text },
  statLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  statSub:   { fontSize: FontSize.xs, color: Colors.textSecondary },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.md },
  totalsRow: { flexDirection: 'row', gap: Spacing.md },
  totalItem: { flex: 1, alignItems: 'center' },
  totalLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 2 },
  totalValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
});
