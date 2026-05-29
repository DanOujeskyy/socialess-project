import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Line } from 'react-native-svg';

import { useTimeStore } from '../../../src/store/time.store';
import { useAuthStore } from '../../../src/store/auth.store';
import { useStatsHistoryStore, type DailyRecord } from '../../../src/store/statsHistory.store';
import { useSettingsStore } from '../../../src/store/settings.store';
import { BudgetRing } from '../../../src/components/stats/BudgetRing';
import { WeeklyBarChart, type WeekBarData } from '../../../src/components/stats/WeeklyBarChart';
import { ActivityHistoryChart, type ActivityDay } from '../../../src/components/stats/ActivityHistoryChart';
import { Card } from '../../../src/components/ui/Card';
import { gameService } from '../../../src/services/game.service';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../../src/theme';
import { DAILY_FREE_TIME_SECONDS, BASE_ACTIVITY_RATES } from '../../../src/constants';
import type { DailyStats, ActiveEffect } from '../../../src/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const CS_DAYS        = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_WEEK_OFFSET = 3;

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function fmtSecs(s: number): string {
  const abs = Math.abs(Math.floor(s));
  const h   = Math.floor(abs / 3600);
  const m   = Math.floor((abs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtNum(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function weekLabel(offset: number): string {
  if (offset === 0) return 'This week';
  if (offset === 1) return 'Last week';
  const now   = new Date();
  const end   = new Date(now);
  end.setDate(end.getDate() - offset * 7);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  const fmt = (d: Date) => `${d.getDate()}. ${d.getMonth() + 1}.`;
  return `${fmt(start)} – ${fmt(end)}`;
}

function buildWeekData(
  records: DailyRecord[],
  today: DailyStats,
  weekOffset: number,
): { bars: WeekBarData[]; activity: ActivityDay[] } {
  const now  = new Date();
  const bars: WeekBarData[]    = [];
  const activity: ActivityDay[] = [];

  for (let i = 6; i >= 0; i--) {
    const d       = new Date(now);
    d.setDate(d.getDate() - i - weekOffset * 7);
    const dateStr = d.toISOString().split('T')[0];
    const isToday = i === 0 && weekOffset === 0;
    const record  = isToday
      ? { ...today, date: dateStr }
      : records.find((r) => r.date === dateStr);

    bars.push({
      label:   CS_DAYS[d.getDay()],
      value:   record?.timeUsed ?? 0,
      isToday,
      hasData: !!record,
    });
    activity.push({
      label:   CS_DAYS[d.getDay()],
      clicks:  record?.clicks ?? 0,
      squats:  record?.squats ?? 0,
      steps:   record?.steps  ?? 0,
      isToday,
    });
  }

  return { bars, activity };
}

function bestRecord(records: DailyRecord[], field: keyof DailyRecord): number {
  return records.reduce((max, r) => Math.max(max, (r[field] as number) ?? 0), 0);
}

// ─── PushupIcon (SVG stick figure) ───────────────────────────────────────────

function PushupIcon({ size = 22, color = '#FFFFFF' }: { size?: number; color?: string }) {
  const sw = Math.max(1.4, size / 18);
  return (
    <Svg width={size} height={size * 0.78} viewBox="0 0 36 28">
      <Circle cx="31" cy="6.5" r="4" stroke={color} strokeWidth={sw + 0.4} fill="none" />
      <Line x1="31" y1="10.5" x2="27" y2="13" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="27" y1="13"  x2="10" y2="18.5" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="23" y1="14.5" x2="20" y2="21.5" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="20" y1="21.5" x2="13" y2="21.5" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="10" y1="18.5" x2="6"  y2="24.5" stroke={color} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="6"  y1="24.5" x2="1"  y2="24.5" stroke={color} strokeWidth={sw} strokeLinecap="round" />
    </Svg>
  );
}

// ─── ActivityGoalCard ─────────────────────────────────────────────────────────
// Replaces the old circular-ring tiles with a clean horizontal progress bar
// that shows actual vs goal, percentage, and earned time.

function ActivityGoalCard({
  icon, label, value, goal, fmtValue, earned, progress, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  goal: number;
  fmtValue: string;
  earned: string;
  progress: number;   // 0–1
  color: string;
}) {
  const barAnim = useRef(new Animated.Value(0)).current;
  const pct     = Math.min(100, Math.round(progress * 100));

  useEffect(() => {
    barAnim.setValue(0);
    Animated.timing(barAnim, {
      toValue:  Math.min(1, progress),
      duration: 900,
      delay:    100,
      easing:   Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const barWidth = barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={[ag.root, { borderLeftColor: color, borderLeftWidth: 3 }]}>
      {/* Top row: icon + name | count / goal */}
      <View style={ag.topRow}>
        <View style={[ag.iconWrap, { backgroundColor: color + '20' }]}>
          {icon}
        </View>
        <Text style={ag.label}>{label}</Text>
        <View style={ag.countWrap}>
          <Text style={[ag.countVal, { color }]}>{fmtValue}</Text>
          <Text style={ag.countGoal}> / {goal}</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={ag.barTrack}>
        <Animated.View
          style={[
            ag.barFill,
            { width: barWidth as any, backgroundColor: color },
          ]}
        />
      </View>

      {/* Bottom row: percentage | earned time */}
      <View style={ag.bottomRow}>
        <Text style={[ag.pct, pct >= 100 ? { color: Colors.success } : { color: Colors.textMuted }]}>
          {pct >= 100 ? '✓ Goal reached!' : `${pct}% of goal`}
        </Text>
        <View style={[ag.earnedBadge, { backgroundColor: color + '18' }]}>
          <Text style={[ag.earnedText, { color }]}>{earned}</Text>
        </View>
      </View>
    </View>
  );
}

const ag = StyleSheet.create({
  root: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  topRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  iconWrap:  { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  label:     { flex: 1, fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.text },
  countWrap: { flexDirection: 'row', alignItems: 'baseline' },
  countVal:  { fontSize: FontSize.lg, fontWeight: FontWeight.heavy, fontVariant: ['tabular-nums' as const] },
  countGoal: { fontSize: FontSize.sm, color: Colors.textMuted, fontVariant: ['tabular-nums' as const] },

  barTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' },
  barFill:  { height: '100%', borderRadius: 4 },

  bottomRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pct:         { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  earnedBadge: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  earnedText:  { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
});

// ─── RecordTile ───────────────────────────────────────────────────────────────

function RecordTile({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <View style={rec.root}>
      <Text style={rec.icon}>{icon}</Text>
      <View style={rec.info}>
        <Text style={[rec.value, { color }]}>{value}</Text>
        <Text style={rec.label}>{label}</Text>
      </View>
    </View>
  );
}

const rec = StyleSheet.create({
  root:  { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceElevated, borderRadius: Radius.xl, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm },
  icon:  { fontSize: 22 },
  info:  { gap: 1 },
  value: { fontSize: FontSize.base, fontWeight: FontWeight.bold, fontVariant: ['tabular-nums' as const] },
  label: { fontSize: FontSize.xs, color: Colors.textMuted },
});

// ─── EffectBadge ──────────────────────────────────────────────────────────────

const CT_ICONS: Record<string, string> = {
  nerf_activities: '🔻', buff_activities: '⬆️', ban_activity: '🚫',
  limit_time_capacity: '🔒', reduce_time: '⏳', increase_time: '⏫',
  reduce_time_frequently: '🕳️', increase_time_frequently: '💧', more_game_cards: '🃏',
};

function EffectBadge({ effect }: { effect: ActiveEffect }) {
  const rCol: Record<string, string> = {
    common: Colors.textMuted, rare: Colors.info,
    epic: Colors.rarity.epic, legendary: Colors.rarity.legendary,
  };
  const color = rCol[effect.rarity] ?? Colors.textMuted;
  const icon  = CT_ICONS[effect.cardType] ?? '✨';
  const isPct = ['nerf_activities', 'buff_activities', 'limit_time_capacity'].includes(effect.cardType);

  return (
    <View style={[eff.root, { borderColor: color + '44' }]}>
      <View style={[eff.iconWrap, { backgroundColor: color + '18' }]}>
        <Text style={eff.icon}>{icon}</Text>
      </View>
      <View style={eff.info}>
        <Text style={[eff.type, { color }]}>{effect.cardType.replace(/_/g, ' ')}</Text>
        <Text style={eff.rarity}>{effect.rarity} · {effect.value}{isPct ? '%' : 'm'}</Text>
      </View>
      {effect.expiresAt && (
        <Text style={eff.expires}>
          {new Date(effect.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      )}
    </View>
  );
}

const eff = StyleSheet.create({
  root:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1 },
  iconWrap:{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  icon:    { fontSize: 18 },
  info:    { flex: 1, gap: 2 },
  type:    { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, textTransform: 'capitalize' as const },
  rarity:  { fontSize: FontSize.xs, color: Colors.textMuted, textTransform: 'capitalize' as const },
  expires: { fontSize: FontSize.xs, color: Colors.textDisabled },
});

// ─── StreakHeatmap ────────────────────────────────────────────────────────────

function StreakHeatmap({ records }: { records: DailyRecord[] }) {
  const now  = new Date();
  const dots = Array.from({ length: 7 }, (_, i) => {
    const d   = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    const key    = d.toISOString().split('T')[0];
    const found  = records.find((r) => r.date === key);
    const isToday = i === 6;
    const active  = isToday || (!!found && (found.clicks > 0 || found.squats > 0 || found.steps > 0));
    return { label: CS_DAYS[d.getDay()], active, isToday };
  });

  return (
    <View style={heat.row}>
      {dots.map((d, i) => (
        <View key={i} style={heat.col}>
          <View style={[heat.dot, d.active ? heat.active : heat.empty, d.isToday && heat.today]} />
          <Text style={[heat.label, d.isToday && { color: Colors.primary }]}>{d.label}</Text>
        </View>
      ))}
    </View>
  );
}

const heat = StyleSheet.create({
  row:   { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  col:   { alignItems: 'center', gap: 4 },
  dot:   { width: 10, height: 10, borderRadius: 5 },
  active:{ backgroundColor: Colors.success + 'AA' },
  empty: { backgroundColor: Colors.border },
  today: { backgroundColor: Colors.primary, width: 12, height: 12, borderRadius: 6 },
  label: { fontSize: 9, color: Colors.textDisabled },
});

// ─── ChartNavigator ───────────────────────────────────────────────────────────

function ChartNavigator({ offset, onOffset }: {
  offset: number;
  onOffset: (o: number) => void;
}) {
  const canBack    = offset < MAX_WEEK_OFFSET;
  const canForward = offset > 0;

  return (
    <View style={nav.row}>
      <TouchableOpacity
        onPress={() => onOffset(offset + 1)}
        disabled={!canBack}
        style={[nav.btn, !canBack && { opacity: 0.25 }]}
        hitSlop={16}
        activeOpacity={0.7}
      >
        <Text style={nav.arrow}>‹</Text>
      </TouchableOpacity>

      <Text style={nav.label}>{weekLabel(offset)}</Text>

      <TouchableOpacity
        onPress={() => onOffset(offset - 1)}
        disabled={!canForward}
        style={[nav.btn, !canForward && { opacity: 0.25 }]}
        hitSlop={16}
        activeOpacity={0.7}
      >
        <Text style={nav.arrow}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

const nav = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  btn:   { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.surfaceHighlight, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  arrow: { fontSize: 22, color: Colors.text, fontWeight: FontWeight.bold, lineHeight: 26 },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
});

// ─── StatsScreen ──────────────────────────────────────────────────────────────

export default function StatsScreen() {
  const insets = useSafeAreaInsets();

  // Reactive store subscriptions
  const {
    dailyStats, currentTime, streak, activeEffects,
    setCurrentTime, setMaxTime, setActiveEffects, setStreak, setDailyStats,
  } = useTimeStore();
  const user  = useAuthStore((s) => s.user);
  const goals = useSettingsStore((s) => s.goals);
  const { records, upsertToday } = useStatsHistoryStore();

  const [weekOffset, setWeekOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // ── Server sync ──────────────────────────────────────────────────────────
  const syncFromServer = useCallback(async () => {
    try {
      const state = await gameService.getMyPlayerState();
      setCurrentTime(state.currentTime);
      setMaxTime(state.maxTime);
      setActiveEffects(state.activeEffects);
      setStreak(state.streak);
      setDailyStats(state.dailyStats);
      // persist fresh data into rolling history
      upsertToday(state.dailyStats);
    } catch {
      // Offline: show whatever is already in the store
      upsertToday(dailyStats);
    }
  }, [setCurrentTime, setMaxTime, setActiveEffects, setStreak, setDailyStats, upsertToday]);

  // Refresh every time the Stats tab comes into focus
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        await syncFromServer();
        if (!cancelled) setLoadingInitial(false);
      })();
      return () => { cancelled = true; };
    }, [syncFromServer]),
  );

  // Also persist history whenever live dailyStats change (e.g. after exercise)
  useEffect(() => {
    if (!loadingInitial) upsertToday(dailyStats);
  }, [dailyStats, loadingInitial]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await syncFromServer();
    setRefreshing(false);
  }, [syncFromServer]);

  // ── Derived data ─────────────────────────────────────────────────────────

  const { bars, activity } = useMemo(
    () => buildWeekData(records, dailyStats, weekOffset),
    [records, dailyStats, weekOffset],
  );

  const maxBarValue = useMemo(
    () => Math.max(goals.dailyTimeLimitSeconds, ...bars.map((b) => b.value)),
    [bars, goals.dailyTimeLimitSeconds],
  );

  const earned = useMemo(() => {
    const c  = dailyStats.clicks * BASE_ACTIVITY_RATES.clicks;
    const sq = dailyStats.squats * BASE_ACTIVITY_RATES.squats;
    const st = Math.floor(dailyStats.steps / 1000 * BASE_ACTIVITY_RATES.stepsPerThousand);
    return { clicks: c, squats: sq, steps: st, total: c + sq + st };
  }, [dailyStats]);

  const weekAvgUsed = useMemo(() => {
    const withData = bars.filter((b) => b.hasData);
    if (withData.length === 0) return 0;
    return withData.reduce((sum, b) => sum + b.value, 0) / withData.length;
  }, [bars]);

  const todayVsAvg = dailyStats.timeUsed - weekAvgUsed;

  const bestClicks = bestRecord(records, 'clicks');
  const bestSquats = bestRecord(records, 'squats');
  const bestSteps  = bestRecord(records, 'steps');
  const bestSaved  = records.reduce(
    (m, r) => Math.max(m, Math.max(0, DAILY_FREE_TIME_SECONDS - r.timeUsed)), 0,
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <LinearGradient colors={[Colors.background, '#0D0D1A']} style={s.gradient}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + Spacing.base }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
        }
      >
        {/* ── Header ────────────────────────────────────────────────────── */}
        <View style={s.header}>
          <Text style={s.title}>Statistics</Text>
          <Text style={s.subtitle}>Track your progress</Text>
          {loadingInitial && (
            <ActivityIndicator
              size="small"
              color={Colors.primary}
              style={{ marginLeft: Spacing.sm }}
            />
          )}
        </View>

        {/* ── Streak Banner ─────────────────────────────────────────────── */}
        <Card elevated>
          <View style={s.streakRow}>
            <View style={s.streakLeft}>
              <Text style={s.streakFlame}>🔥</Text>
              <View>
                <Text style={s.streakValue}>
                  {streak} {streak === 1 ? 'day' : 'days'}
                </Text>
                <Text style={s.streakSub}>Current streak</Text>
              </View>
            </View>
            <View style={s.streakRight}>
              <Text style={s.bestStreakVal}>{user?.totalStreak ?? 0}</Text>
              <Text style={s.bestStreakLbl}>🏆 Best</Text>
            </View>
          </View>
          <View style={s.divider} />
          <StreakHeatmap records={records} />
        </Card>

        {/* ── Budget Ring ───────────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Daily Limit</Text>
          <Card>
            <View style={s.ringRow}>
              <BudgetRing
                usedSeconds={dailyStats.timeUsed}
                totalSeconds={DAILY_FREE_TIME_SECONDS}
                remainingSeconds={currentTime}
                earnedSeconds={earned.total}
              />
              <View style={s.ringStats}>
                <View style={s.ringStat}>
                  <Text style={[s.ringVal, { color: Colors.danger }]}>{fmtSecs(dailyStats.timeUsed)}</Text>
                  <Text style={s.ringLbl}>Used</Text>
                </View>
                <View style={s.ringStat}>
                  <Text style={[s.ringVal, { color: Colors.success }]}>+{fmtSecs(earned.total)}</Text>
                  <Text style={s.ringLbl}>Earned by exercise</Text>
                </View>
                <View style={s.ringStat}>
                  <Text style={[s.ringVal, { color: Colors.primary }]}>{fmtSecs(DAILY_FREE_TIME_SECONDS)}</Text>
                  <Text style={s.ringLbl}>Daily limit</Text>
                </View>
                {weekAvgUsed > 0 && (
                  <View style={[s.ringStat, s.vsAvg]}>
                    <Text style={[s.ringVal, {
                      color: todayVsAvg > 0 ? Colors.danger : Colors.success,
                      fontSize: FontSize.sm,
                    }]}>
                      {todayVsAvg > 0 ? '▲' : '▼'} {fmtSecs(Math.abs(todayVsAvg))}
                    </Text>
                    <Text style={s.ringLbl}>vs. weekly avg</Text>
                  </View>
                )}
              </View>
            </View>
          </Card>
        </View>

        {/* ── Weekly Screen Time ────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Social Media Usage</Text>
          <Card>
            <ChartNavigator offset={weekOffset} onOffset={setWeekOffset} />
            {/* key forces chart to re-animate when week changes */}
            <WeeklyBarChart
              key={`usage-${weekOffset}`}
              data={bars}
              maxValue={maxBarValue}
              limitValue={goals.dailyTimeLimitSeconds}
            />
            <View style={s.legend}>
              <View style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: Colors.border }]} />
                <Text style={s.legendTxt}>- - daily goal {fmtSecs(goals.dailyTimeLimitSeconds)}</Text>
              </View>
            </View>
          </Card>
        </View>

        {/* ── Exercise Activity ─────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Physical Activity</Text>
          <Card>
            <ChartNavigator offset={weekOffset} onOffset={setWeekOffset} />
            <ActivityHistoryChart key={`activity-${weekOffset}`} data={activity} />
          </Card>
        </View>

        {/* ── Today's Activity — goal progress cards ────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Today's Activity</Text>

          <ActivityGoalCard
            icon={<PushupIcon size={22} color={Colors.primary} />}
            label="Push-ups"
            value={dailyStats.clicks}
            goal={goals.clicksGoal}
            fmtValue={String(dailyStats.clicks)}
            earned={`+${fmtSecs(earned.clicks)}`}
            progress={dailyStats.clicks / Math.max(1, goals.clicksGoal)}
            color={Colors.primary}
          />
          <ActivityGoalCard
            icon={<Text style={{ fontSize: 20 }}>🏋️</Text>}
            label="Squats"
            value={dailyStats.squats}
            goal={goals.squatsGoal}
            fmtValue={String(dailyStats.squats)}
            earned={`+${fmtSecs(earned.squats)}`}
            progress={dailyStats.squats / Math.max(1, goals.squatsGoal)}
            color={Colors.success}
          />
          <ActivityGoalCard
            icon={<Text style={{ fontSize: 20 }}>👟</Text>}
            label="Steps"
            value={dailyStats.steps}
            goal={goals.stepsGoal}
            fmtValue={fmtNum(dailyStats.steps)}
            earned={`+${fmtSecs(earned.steps)}`}
            progress={dailyStats.steps / Math.max(1, goals.stepsGoal)}
            color={Colors.warning}
          />
        </View>

        {/* ── Personal Records ──────────────────────────────────────────── */}
        {records.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Personal Records</Text>
            <View style={s.recGrid}>
              <RecordTile icon="💪" label="Max push-ups / day" value={String(bestClicks)} color={Colors.primary} />
              <RecordTile icon="🏋️" label="Max squats / day"   value={String(bestSquats)} color={Colors.success} />
            </View>
            <View style={s.recGrid}>
              <RecordTile icon="👟" label="Max steps / day"             value={fmtNum(bestSteps)} color={Colors.warning} />
              <RecordTile icon="🏅" label="Least time on social / day"  value={fmtSecs(bestSaved)} color={Colors.secondary} />
            </View>
          </View>
        )}

        {/* ── Active Effects ────────────────────────────────────────────── */}
        {activeEffects.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Active Effects ({activeEffects.length})</Text>
            <View style={s.effectsList}>
              {activeEffects.map((e) => <EffectBadge key={e.id} effect={e} />)}
            </View>
          </View>
        )}

        <View style={{ height: Spacing['2xl'] }} />
      </ScrollView>
    </LinearGradient>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  gradient: { flex: 1 },
  scroll:   { padding: Spacing.base, gap: Spacing.base },

  header: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xs, gap: 0 },
  title:  { fontSize: FontSize['2xl'], fontWeight: FontWeight.heavy, color: Colors.text },
  subtitle:{ fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2, flex: 1 },

  streakRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  streakLeft:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  streakFlame:   { fontSize: 36 },
  streakValue:   { fontSize: FontSize['2xl'], fontWeight: FontWeight.heavy, color: Colors.warning },
  streakSub:     { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
  streakRight:   { alignItems: 'center' },
  bestStreakVal: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text },
  bestStreakLbl: { fontSize: FontSize.xs, color: Colors.textMuted },
  divider:       { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.md },

  section:      { gap: Spacing.sm },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.3,
  },

  ringRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  ringStats:{ flex: 1, gap: Spacing.md },
  ringStat: { gap: 1 },
  ringVal:  { fontSize: FontSize.base, fontWeight: FontWeight.bold, fontVariant: ['tabular-nums'] },
  ringLbl:  { fontSize: FontSize.xs, color: Colors.textMuted },
  vsAvg: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    padding: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  legend:     { flexDirection: 'row', gap: Spacing.base, marginTop: Spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:  { width: 8, height: 8, borderRadius: 4 },
  legendTxt:  { fontSize: FontSize.xs, color: Colors.textMuted },

  recGrid:    { flexDirection: 'row', gap: Spacing.sm },
  effectsList:{ gap: Spacing.xs },
});
