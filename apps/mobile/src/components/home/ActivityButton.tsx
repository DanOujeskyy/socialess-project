import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../theme';
import { useTimeStore } from '../../store/time.store';
import { activitiesService } from '../../services/activities.service';
import type { ActivityType } from '../../types';

interface ActivityConfig {
  type: ActivityType;
  icon: string;
  label: string;
  tapLabel?: string;
}

const ACTIVITIES: ActivityConfig[] = [
  { type: 'squats',  icon: '🏋️', label: 'Squats',  tapLabel: 'Tap = 1 Squat' },
  { type: 'clicks',  icon: '👆', label: 'Clicks',  tapLabel: 'Tap = 1 Click' },
];

interface ActivityButtonProps {
  activity: ActivityConfig;
}

function SingleActivityButton({ activity }: ActivityButtonProps) {
  const [count, setCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const { addTime, incrementClicks, incrementSquats, isBanned, getEffectiveActivityRate } = useTimeStore();

  const banned = isBanned(activity.type);

  const handleTap = useCallback(async () => {
    if (banned) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Banned', `You cannot earn time from ${activity.label} right now.`);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newCount = count + 1;
    setCount(newCount);

    // Batch sync every 5 taps or after debounce
    if (newCount % 5 === 0) {
      setSyncing(true);
      try {
        const result = await activitiesService[
          activity.type === 'clicks' ? 'recordClicks' : 'recordSquats'
        ](5);
        addTime(result.secondsAdded);
        if (activity.type === 'clicks')  incrementClicks(5);
        if (activity.type === 'squats')  incrementSquats(5);
      } catch {
        // Store pending, retry later
      } finally {
        setSyncing(false);
      }
    }
  }, [count, banned, activity]);

  const rate = getEffectiveActivityRate(
    activity.type === 'steps' ? 'stepsPerThousand' : activity.type,
  );

  return (
    <TouchableOpacity
      style={[styles.button, banned && styles.banned]}
      onPress={handleTap}
      activeOpacity={0.7}
    >
      <Text style={styles.icon}>{activity.icon}</Text>
      <Text style={styles.count}>{count}</Text>
      <Text style={styles.label}>{activity.label}</Text>
      <Text style={styles.rate}>+{rate.toFixed(0)}s each</Text>
      {banned && <View style={styles.banOverlay}><Text style={styles.banText}>BANNED</Text></View>}
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
    minHeight: 110,
    justifyContent: 'center',
    gap: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  banned: { opacity: 0.5 },
  icon: { fontSize: 28 },
  count: {
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.heavy,
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  rate: { fontSize: FontSize.xs, color: Colors.success },
  banOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  banText: { color: Colors.danger, fontSize: FontSize.sm, fontWeight: FontWeight.bold, letterSpacing: 1 },
});
