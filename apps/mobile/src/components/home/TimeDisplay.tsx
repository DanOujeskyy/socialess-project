import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ProgressBar } from '../ui/ProgressBar';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../theme';
import { useTimeStore } from '../../store/time.store';

function formatTime(seconds: number): string {
  const abs = Math.abs(seconds);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  const sign = seconds < 0 ? '-' : '';
  if (h > 0) return `${sign}${h}h ${m}m`;
  if (m > 0) return `${sign}${m}m ${String(s).padStart(2, '0')}s`;
  return `${sign}${s}s`;
}

export function TimeDisplay() {
  const currentTime  = useTimeStore((s) => s.currentTime);
  const maxTime      = useTimeStore((s) => s.getEffectiveMaxTime());
  const isNegative   = currentTime < 0;
  const progress     = maxTime > 0 ? Math.max(0, currentTime / maxTime) : 0;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Social Media Time</Text>
      <Text style={[styles.time, isNegative && styles.negative]}>
        {formatTime(currentTime)}
      </Text>
      <ProgressBar value={progress} style={styles.bar} />
      <Text style={styles.maxLabel}>
        Max: {formatTime(Math.floor(maxTime))}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  label: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  time: {
    fontSize: 56,
    fontWeight: FontWeight.heavy,
    color: Colors.text,
    letterSpacing: -1,
    marginBottom: Spacing.base,
    fontVariant: ['tabular-nums'],
  },
  negative: { color: Colors.danger },
  bar: { width: '100%', marginBottom: Spacing.sm },
  maxLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
});
