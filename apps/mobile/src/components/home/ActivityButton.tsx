import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../theme';
import { useTimeStore } from '../../store/time.store';
import type { ActivityType } from '../../types';

interface ActivityConfig {
  type: ActivityType;
  icon: string;
  label: string;
  subLabel: string;
}

const ACTIVITIES: ActivityConfig[] = [
  { type: 'squats', icon: '🏋️', label: 'Dřepy', subLabel: 'Kamera' },
  { type: 'clicks', icon: '💪', label: 'Kliky',  subLabel: 'Kamera' },
];

function SingleActivityButton({ activity }: { activity: ActivityConfig }) {
  const { dailyStats, isBanned, getEffectiveActivityRate } = useTimeStore();
  const banned = isBanned(activity.type as 'clicks' | 'squats');

  const count = activity.type === 'clicks' ? dailyStats.clicks : dailyStats.squats;
  const rate  = getEffectiveActivityRate(
    activity.type === 'steps' ? 'stepsPerThousand' : (activity.type as 'clicks' | 'squats'),
  );

  const handlePress = () => {
    if (banned) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Zakázáno', `Nyní nemůžeš vydělávat čas z ${activity.label}.`);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/(app)/exercise',
      params: { type: activity.type },
    });
  };

  return (
    <TouchableOpacity
      style={[styles.button, banned && styles.banned]}
      onPress={handlePress}
      activeOpacity={0.75}
    >
      <Text style={styles.icon}>{activity.icon}</Text>
      <Text style={styles.count}>{count}</Text>
      <Text style={styles.label}>{activity.label}</Text>
      <View style={styles.cameraRow}>
        <Text style={styles.cameraIcon}>📷</Text>
        <Text style={styles.rate}>+{rate.toFixed(0)}s / rep</Text>
      </View>
      {banned && (
        <View style={styles.banOverlay}>
          <Text style={styles.banText}>ZAKÁZÁNO</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export function ActivityButtons() {
  return (
    <View style={styles.row}>
      {ACTIVITIES.map((a) => (
        <SingleActivityButton key={a.type} activity={a} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.md },
  button: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 120,
    justifyContent: 'center',
    gap: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  banned: { opacity: 0.5 },
  icon:  { fontSize: 28 },
  count: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.heavy,
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  cameraRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  cameraIcon: { fontSize: 10 },
  rate:  { fontSize: FontSize.xs, color: Colors.success },
  banOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  banText: {
    color: Colors.danger,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 1,
  },
});
