/**
 * TimeUpBlocker
 *
 * Renders as a React Native Modal (above all native screens) when the user's
 * daily social-media budget is exhausted. The modal is intentionally
 * un-dismissable — the only way out is to earn time by exercising.
 *
 * Visibility rules:
 *   - Show when currentTime <= 0 AND no social session is currently in flight
 *   - Hide automatically while the user is on the exercise screen so the
 *     camera UI is fully visible (usePathname tracks the active route)
 *   - Hide automatically once currentTime > 0 (time was earned)
 *
 * Android back-button is intercepted and swallowed while visible.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  BackHandler,
  Platform,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { router, usePathname } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTimeStore } from '../../store/time.store';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../theme';
import { DAILY_FREE_TIME_SECONDS, BASE_ACTIVITY_RATES } from '../../constants';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(s: number): string {
  const abs = Math.abs(Math.floor(s));
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const sec = abs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec.toString().padStart(2, '0')}s`;
  return `${sec}s`;
}

// ─── ExerciseRow ──────────────────────────────────────────────────────────────

function ExerciseRow({
  emoji,
  label,
  rateLabel,
  reps,
  onPress,
  accent,
}: {
  emoji: string;
  label: string;
  rateLabel: string;
  reps: string;
  onPress: () => void;
  accent: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.exerciseRow, { borderColor: accent + '44' }]}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <View style={[styles.exerciseIconWrap, { backgroundColor: accent + '22' }]}>
        <Text style={styles.exerciseEmoji}>{emoji}</Text>
      </View>
      <View style={styles.exerciseInfo}>
        <Text style={styles.exerciseLabel}>{label}</Text>
        <Text style={styles.exerciseRate}>{rateLabel}</Text>
      </View>
      <View style={styles.exerciseRight}>
        <Text style={[styles.exerciseReps, { color: accent }]}>{reps}</Text>
        <Text style={styles.exerciseArrow}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── TimeUpBlocker ────────────────────────────────────────────────────────────

export function TimeUpBlocker() {
  const { currentTime, isSocialActive, dailyStats } = useTimeStore();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  // Hide while user is earning time on the exercise screen —
  // our Modal sits above native screens so we must suppress it explicitly.
  const isExercising = pathname.includes('exercise');
  const visible = currentTime <= 0 && !isSocialActive && !isExercising;

  // ── Pulse animation for the icon ──────────────────────────────────────────
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseRef  = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!visible) {
      pulseRef.current?.stop();
      pulseAnim.setValue(1);
      return;
    }
    pulseRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.18,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    pulseRef.current.start();
    return () => pulseRef.current?.stop();
  }, [visible, pulseAnim]);

  // ── Block Android hardware back button ────────────────────────────────────
  useEffect(() => {
    if (!visible || Platform.OS !== 'android') return;
    const handler = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => handler.remove();
  }, [visible]);

  // ── Haptic feedback on mount ──────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [visible]);

  // ── Navigate to exercise ──────────────────────────────────────────────────
  const openExercise = useCallback((type: 'clicks' | 'squats') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: '/(app)/exercise', params: { type } });
  }, []);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const timeUsed    = dailyStats.timeUsed;
  const usedPct     = DAILY_FREE_TIME_SECONDS > 0
    ? Math.min(100, Math.round((timeUsed / DAILY_FREE_TIME_SECONDS) * 100))
    : 100;

  // How many reps needed to get 5 minutes
  const pushForFive  = Math.ceil(300 / BASE_ACTIVITY_RATES.clicks);
  const squatForFive = Math.ceil(300 / BASE_ACTIVITY_RATES.squats);

  if (!visible) return null;

  return (
    <Modal
      visible
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      onRequestClose={() => {/* intentionally blocked */}}
    >
      <LinearGradient
        colors={['#08060F', '#0F0A1A', '#08060F']}
        style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 12 }]}
      >
        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <View style={styles.hero}>
          <Animated.Text
            style={[styles.heroIcon, { transform: [{ scale: pulseAnim }] }]}
          >
            ⛔
          </Animated.Text>

          <Text style={styles.heroTitle}>Time's Up</Text>
          <Text style={styles.heroSub}>
            Your daily social media budget is exhausted.{'\n'}
            Earn more time by working out to continue.
          </Text>
        </View>

        {/* ── Usage Stats ─────────────────────────────────────────────────── */}
        <View style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{fmtTime(timeUsed)}</Text>
              <Text style={styles.statLabel}>Used today</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, styles.statDanger]}>0:00</Text>
              <Text style={styles.statLabel}>Remaining</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, styles.statWarning]}>{usedPct}%</Text>
              <Text style={styles.statLabel}>Of daily limit</Text>
            </View>
          </View>

          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${usedPct}%` }]} />
          </View>
        </View>

        {/* ── Exercise CTAs ────────────────────────────────────────────────── */}
        <View style={styles.earnSection}>
          <Text style={styles.earnTitle}>How to get 5 minutes back?</Text>

          <ExerciseRow
            emoji="🤸"
            label="Push Ups"
            rateLabel={`+${BASE_ACTIVITY_RATES.clicks}s per rep`}
            reps={`${pushForFive} reps = +5 min`}
            accent="#8B5CF6"
            onPress={() => openExercise('clicks')}
          />

          <ExerciseRow
            emoji="🏋️"
            label="Squats"
            rateLabel={`+${BASE_ACTIVITY_RATES.squats}s per rep`}
            reps={`${squatForFive} reps = +5 min`}
            accent="#22C55E"
            onPress={() => openExercise('squats')}
          />
        </View>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <View style={styles.footer}>
          <View style={styles.footerBadge}>
            <Text style={styles.footerBadgeText}>
              💪  Movement is a reward, not a punishment
            </Text>
          </View>
        </View>
      </LinearGradient>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: 'space-between',
  },

  // ── Hero ────────────────────────────────────────────────────────────────
  hero: {
    alignItems: 'center',
    paddingTop: Spacing['2xl'],
    gap: Spacing.sm,
  },
  heroIcon: {
    fontSize: 72,
    marginBottom: Spacing.xs,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: FontWeight.heavy,
    color: Colors.text,
    letterSpacing: 0.4,
  },
  heroSub: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // ── Stats ────────────────────────────────────────────────────────────────
  statsCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: Radius.xl,
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: Spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  statValue: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  statDanger:  { color: '#EF4444' },
  statWarning: { color: '#F59E0B' },

  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#EF4444',
    borderRadius: 2,
  },

  // ── Earn Section ─────────────────────────────────────────────────────────
  earnSection: {
    gap: Spacing.sm,
  },
  earnTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginBottom: 2,
  },

  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: Radius.xl,
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing.base,
    borderWidth: 1,
    gap: Spacing.md,
  },
  exerciseIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseEmoji: { fontSize: 26 },
  exerciseInfo: { flex: 1, gap: 3 },
  exerciseLabel: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  exerciseRate: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  exerciseRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  exerciseReps: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  exerciseArrow: {
    fontSize: 22,
    color: Colors.textMuted,
    fontWeight: FontWeight.bold,
  },

  // ── Footer ───────────────────────────────────────────────────────────────
  footer: {
    alignItems: 'center',
    paddingBottom: Spacing.sm,
  },
  footerBadge: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  footerBadgeText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    letterSpacing: 0.3,
  },
});
