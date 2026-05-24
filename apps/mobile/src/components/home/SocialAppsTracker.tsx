import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../theme';
import { SOCIAL_APPS_CONFIG } from '../../constants';
import { useTimeStore } from '../../store/time.store';
import { activitiesService } from '../../services/activities.service';
import { scheduleTimeWarningNotification } from '../../hooks/useNotifications';
import { TIME_WARNING_THRESHOLD_SECONDS } from '../../constants';
import type { SocialApp } from '../../types';

const APPS = Object.entries(SOCIAL_APPS_CONFIG) as [SocialApp, { name: string; color: string }][];

export function SocialAppsTracker() {
  const { isSocialActive, activeSocialApp, startSocialUsage, stopSocialUsage, currentTime, consumeTime } =
    useTimeStore();

  const [warned, setWarned] = useState(false);

  const handleStart = (app: SocialApp) => {
    if (currentTime <= 0) {
      Alert.alert('No Time Left', 'You have no social media time remaining. Earn more through activities!');
      return;
    }
    startSocialUsage(app);
    setWarned(false);
  };

  const handleStop = async () => {
    const elapsed = stopSocialUsage();
    if (elapsed > 0 && activeSocialApp) {
      try {
        const result = await activitiesService.logSocialMediaUsage(activeSocialApp, elapsed);
        consumeTime(elapsed);
      } catch {
        consumeTime(elapsed);
      }
    }
  };

  // Check for low time warning
  React.useEffect(() => {
    if (isSocialActive && currentTime <= TIME_WARNING_THRESHOLD_SECONDS && !warned) {
      setWarned(true);
      scheduleTimeWarningNotification(currentTime);
    }
    if (isSocialActive && currentTime <= 0) {
      handleStop();
      Alert.alert('Time Up!', 'Your social media time has run out.');
    }
  }, [currentTime, isSocialActive]);

  if (isSocialActive && activeSocialApp) {
    const app = SOCIAL_APPS_CONFIG[activeSocialApp as SocialApp];
    return (
      <View style={[styles.activeContainer, { borderColor: app.color + '55' }]}>
        <View style={[styles.activeDot, { backgroundColor: app.color }]} />
        <Text style={styles.activeText}>Using {app.name}</Text>
        <TouchableOpacity style={[styles.stopBtn, { backgroundColor: app.color }]} onPress={handleStop}>
          <Text style={styles.stopText}>Stop</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Open Social App</Text>
      <View style={styles.appGrid}>
        {APPS.map(([key, cfg]) => (
          <TouchableOpacity
            key={key}
            style={[styles.appBtn, { borderColor: cfg.color + '44' }]}
            onPress={() => handleStart(key)}
            activeOpacity={0.75}
          >
            <View style={[styles.appDot, { backgroundColor: cfg.color }]} />
            <Text style={styles.appName}>{cfg.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  heading: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  appGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  appBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    gap: 6,
  },
  appDot: { width: 8, height: 8, borderRadius: 4 },
  appName: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  activeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1.5,
    gap: Spacing.sm,
  },
  activeDot: { width: 10, height: 10, borderRadius: 5 },
  activeText: { flex: 1, fontSize: FontSize.base, color: Colors.text, fontWeight: FontWeight.medium },
  stopBtn: { borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  stopText: { color: Colors.text, fontWeight: FontWeight.bold, fontSize: FontSize.sm },
});
