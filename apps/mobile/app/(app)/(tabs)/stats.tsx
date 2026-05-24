import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTimeStore } from '../../../src/store/time.store';
import { useAuthStore } from '../../../src/store/auth.store';
import { StatCard } from '../../../src/components/stats/StatCard';
import { Card } from '../../../src/components/ui/Card';
import { ProgressBar } from '../../../src/components/ui/ProgressBar';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../../src/theme';
import { DAILY_FREE_TIME_SECONDS, DEFAULT_MAX_TIME_SECONDS } from '../../../src/constants';

function formatSeconds(s: number): string {
  const abs = Math.abs(s);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const { dailyStats, currentTime, maxTime, streak, activeEffects } = useTimeStore();
  const user = useAuthStore((s) => s.user);

  const totalEarned   = dailyStats.timeEarned;
  const totalUsed     = dailyStats.timeUsed;
  const savings       = totalUsed > 0 ? Math.max(0, DAILY_FREE_TIME_SECONDS - totalUsed) : 0;
  const activityTotal = dailyStats.clicks * 15 + dailyStats.squats * 10 + Math.floor(dailyStats.steps / 1000 * 90);

  return (
    <LinearGradient colors={[Colors.background, '#0D0D1A']} style={styles.gradient}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + Spacing.base }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Statistics</Text>
          <Text style={styles.subtitle}>Track your progress</Text>
        </View>

        {/* Streak Banner */}
        <Card elevated style={styles.streakCard}>
          <View style={styles.streakRow}>
            <Text style={styles.streakFlame}>🔥</Text>
            <View>
              <Text style={styles.streakValue}>{streak} Days</Text>
              <Text style={styles.streakLabel}>Current Streak</Text>
            </View>
            <View style={styles.totalStreakWrap}>
              <Text style={styles.totalStreakValue}>{user?.totalStreak ?? 0}</Text>
              <Text style={styles.totalStreakLabel}>Best</Text>
            </View>
          </View>
        </Card>

        {/* Today's Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Activity</Text>
          <View style={styles.statGrid}>
            <StatCard icon="👆" label="Clicks" value={String(dailyStats.clicks)}
              subValue={`+${formatSeconds(dailyStats.clicks * 15)}`} color={Colors.info} />
            <StatCard icon="🏋️" label="Squats" value={String(dailyStats.squats)}
              subValue={`+${formatSeconds(dailyStats.squats * 10)}`} color={Colors.success} />
          </View>
          <View style={styles.statGrid}>
            <StatCard icon="👟" label="Steps" value={dailyStats.steps.toLocaleString()}
              subValue={`+${formatSeconds(Math.floor(dailyStats.steps / 1000 * 90))}`} color={Colors.warning} />
            <StatCard icon="⏱️" label="Earned" value={formatSeconds(activityTotal)}
              subValue="from activities" color={Colors.secondary} />
          </View>
        </View>

        {/* Screen Time */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Screen Time</Text>
          <Card>
            <View style={styles.timeRow}>
              <View style={styles.timeItem}>
                <Text style={styles.timeValue}>{formatSeconds(totalUsed)}</Text>
                <Text style={styles.timeLabel}>Used Today</Text>
              </View>
              <View style={styles.timeDivider} />
              <View style={styles.timeItem}>
                <Text style={[styles.timeValue, { color: Colors.success }]}>
                  {formatSeconds(savings)}
                </Text>
                <Text style={styles.timeLabel}>Saved</Text>
              </View>
              <View style={styles.timeDivider} />
              <View style={styles.timeItem}>
                <Text style={[styles.timeValue, { color: currentTime < 300 ? Colors.danger : Colors.text }]}>
                  {formatSeconds(currentTime)}
                </Text>
                <Text style={styles.timeLabel}>Remaining</Text>
              </View>
            </View>

            <View style={styles.barSection}>
              <View style={styles.barRow}>
                <Text style={styles.barLabel}>Daily budget usage</Text>
                <Text style={styles.barPct}>
                  {DAILY_FREE_TIME_SECONDS > 0 ? Math.round((totalUsed / DAILY_FREE_TIME_SECONDS) * 100) : 0}%
                </Text>
              </View>
              <ProgressBar
                value={DAILY_FREE_TIME_SECONDS > 0 ? totalUsed / DAILY_FREE_TIME_SECONDS : 0}
                color={Colors.danger}
              />
            </View>
          </Card>
        </View>

        {/* Active Effects */}
        {activeEffects.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Active Effects</Text>
            <View style={styles.effectsList}>
              {activeEffects.map((effect) => (
                <View key={effect.id} style={styles.effectItem}>
                  <View style={styles.effectLeft}>
                    <Text style={styles.effectType}>
                      {effect.cardType.replace(/_/g, ' ')}
                    </Text>
                    <Text style={styles.effectRarity}>{effect.rarity}</Text>
                  </View>
                  <Text style={styles.effectValue}>
                    {effect.value}
                    {['nerf_activities', 'buff_activities', 'limit_time_capacity'].includes(effect.cardType) ? '%' : 'm'}
                  </Text>
                  {effect.expiresAt && (
                    <Text style={styles.effectExpiry}>
                      Expires {new Date(effect.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: Spacing['2xl'] }} />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  scroll: { padding: Spacing.base, gap: Spacing.base },
  header: { gap: 2 },
  title: { fontSize: FontSize['2xl'], fontWeight: FontWeight.heavy, color: Colors.text },
  subtitle: { fontSize: FontSize.sm, color: Colors.textMuted },
  streakCard: { padding: Spacing.base },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  streakFlame: { fontSize: 36 },
  streakValue: { fontSize: FontSize['2xl'], fontWeight: FontWeight.heavy, color: Colors.warning },
  streakLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  totalStreakWrap: { marginLeft: 'auto', alignItems: 'center' },
  totalStreakValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text },
  totalStreakLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  section: { gap: Spacing.sm },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  statGrid: { flexDirection: 'row', gap: Spacing.sm },
  timeRow: { flexDirection: 'row', marginBottom: Spacing.md },
  timeItem: { flex: 1, alignItems: 'center' },
  timeDivider: { width: 1, backgroundColor: Colors.border },
  timeValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text },
  timeLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  barSection: { gap: Spacing.xs },
  barRow: { flexDirection: 'row', justifyContent: 'space-between' },
  barLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  barPct: { fontSize: FontSize.xs, color: Colors.textSecondary },
  effectsList: { gap: Spacing.xs },
  effectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  effectLeft: { flex: 1 },
  effectType: { fontSize: FontSize.sm, color: Colors.text, fontWeight: FontWeight.medium, textTransform: 'capitalize' },
  effectRarity: { fontSize: FontSize.xs, color: Colors.textMuted, textTransform: 'capitalize' },
  effectValue: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.warning, marginRight: Spacing.sm },
  effectExpiry: { fontSize: FontSize.xs, color: Colors.textMuted },
});
