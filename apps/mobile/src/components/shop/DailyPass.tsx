/**
 * DailyPass
 *
 * Renders the full pass UI:
 *  1. PassHeader   — status card (golden gradient, day N/30, progress bar)
 *  2. TodayReward  — the single claimable reward for today (pass active only)
 *  3. RewardsGrid  — 5-column × 6-row calendar of all 30 days (pass active only)
 *  4. UpgradeCard  — shown when pass is NOT active
 */

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useGameStore } from '../../store/game.store';
import { useTimeStore } from '../../store/time.store';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../theme';
import { PASS_REWARDS, PASS_MONTHLY_PRICE } from '../../constants';
import type { PassReward } from '../../types';

// ─── Layout constants ─────────────────────────────────────────────────────────

const { width: SCREEN_W } = Dimensions.get('window');
const GRID_PADDING = Spacing.base;        // horizontal padding of the grid card
const GRID_COLS    = 5;
const CELL_GAP     = 7;
const CELL_W       = Math.floor(
  (SCREEN_W - Spacing.base * 2 - GRID_PADDING * 2 - CELL_GAP * (GRID_COLS - 1)) / GRID_COLS,
);
const CELL_H = Math.round(CELL_W * 1.35);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

/** Days elapsed since passStartDate, capped to 1–30. */
function computePassDay(startDate: string): number {
  if (!startDate) return 1;
  const start = new Date(startDate);
  const now   = new Date();
  const diff  = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  return Math.min(30, Math.max(1, diff + 1));
}

/** Milliseconds until midnight tonight (for "resets in X" display). */
function msUntilMidnight(): number {
  const now  = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}

function fmtCountdown(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

// ─── Mock card generator for DEV claiming ─────────────────────────────────────

function makeMockCard(reward: PassReward) {
  const CARD_TYPES = [
    'buff_activities', 'increase_time', 'more_game_cards',
  ] as const;
  const type = CARD_TYPES[reward.day % CARD_TYPES.length];
  return {
    id:         `pass_${reward.day}_${Date.now()}`,
    type,
    rarity:     reward.rarity!,
    effect:     { type, rarity: reward.rarity!, value: 1 },
    obtainedAt: new Date().toISOString(),
  };
}

function makeMockCrate(reward: PassReward) {
  return {
    id:     `pass_crate_${reward.day}_${Date.now()}`,
    type:   reward.crateType! as 'basic' | 'premium',
    opened: false,
  };
}

// ─── Cell component ───────────────────────────────────────────────────────────

type CellVariant = 'today' | 'today-claimed' | 'claimed' | 'missed' | 'future';

function RewardCell({
  reward,
  variant,
}: {
  reward: PassReward;
  variant: CellVariant;
}) {
  const isToday    = variant === 'today' || variant === 'today-claimed';
  const isClaimed  = variant === 'claimed' || variant === 'today-claimed';
  const isMissed   = variant === 'missed';
  const isFuture   = variant === 'future';

  const borderColor = isToday
    ? '#C49A3C'
    : isClaimed
    ? Colors.success + '66'
    : isMissed
    ? Colors.border
    : Colors.border;

  const bgColor = isToday
    ? '#1E1400'
    : isClaimed
    ? Colors.success + '0A'
    : Colors.surfaceElevated;

  const iconDisplay = isClaimed
    ? '✓'
    : isMissed
    ? '✗'
    : reward.icon;

  const iconColor = isClaimed
    ? Colors.success
    : isMissed
    ? Colors.textDisabled
    : Colors.text;

  const labelColor = isClaimed
    ? Colors.success
    : isMissed
    ? Colors.textDisabled
    : reward.color;

  return (
    <View
      style={[
        cell.root,
        { width: CELL_W, height: CELL_H, borderColor, backgroundColor: bgColor },
        isToday && cell.todayBorder,
        (isMissed || isFuture) && { opacity: isMissed ? 0.45 : 0.65 },
      ]}
    >
      {/* Day number */}
      <Text style={[cell.dayNum, isToday && { color: '#FCD34D', fontWeight: FontWeight.bold }]}>
        {reward.day}
      </Text>

      {/* Icon */}
      <Text style={[cell.icon, isClaimed && { color: iconColor }]}>
        {iconDisplay}
      </Text>

      {/* Short label */}
      <Text style={[cell.label, { color: labelColor }]} numberOfLines={1} adjustsFontSizeToFit>
        {isClaimed ? '✓ done' : isMissed ? 'missed' : reward.label}
      </Text>

      {/* TODAY badge */}
      {variant === 'today' && (
        <View style={cell.todayBadge}>
          <Text style={cell.todayBadgeTxt}>TODAY</Text>
        </View>
      )}
    </View>
  );
}

const cell = StyleSheet.create({
  root: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 6,
    paddingHorizontal: 2,
    overflow: 'hidden',
  },
  todayBorder: {
    borderWidth: 2,
    ...Platform.select({
      ios: { shadowColor: '#C49A3C', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  dayNum: {
    fontSize: 9,
    color: Colors.textDisabled,
    fontVariant: ['tabular-nums'],
  },
  icon:  { fontSize: 18 },
  label: {
    fontSize: 9,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
  todayBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#C49A3C',
    paddingVertical: 1,
    alignItems: 'center',
  },
  todayBadgeTxt: {
    fontSize: 7,
    fontWeight: FontWeight.heavy,
    color: '#0A0600',
    letterSpacing: 0.5,
  },
});

// ─── PassHeader ───────────────────────────────────────────────────────────────

function PassHeader({
  isActive,
  passDay,
  alreadyClaimed,
}: {
  isActive: boolean;
  passDay:  number;
  alreadyClaimed: boolean;
}) {
  const progress = passDay / 30;

  return (
    <LinearGradient
      colors={['#160D00', '#221500', '#160D00']}
      style={hdr.root}
    >
      {/* Title row */}
      <View style={hdr.titleRow}>
        <View style={hdr.titleLeft}>
          <Text style={hdr.crown}>👑</Text>
          <View>
            <Text style={hdr.title}>Daily Pass</Text>
            <Text style={hdr.subtitle}>30-day reward cycle</Text>
          </View>
        </View>
        <View style={[hdr.badge, isActive ? hdr.badgeActive : hdr.badgeInactive]}>
          <Text style={[hdr.badgeTxt, isActive ? hdr.badgeTxtActive : hdr.badgeTxtInactive]}>
            {isActive ? '● Active' : '○ Inactive'}
          </Text>
        </View>
      </View>

      {/* Progress row */}
      {isActive && (
        <>
          <View style={hdr.progressRow}>
            <Text style={hdr.dayLabel}>Day {passDay} / 30</Text>
            <Text style={hdr.timeLabel}>
              Resets in {fmtCountdown(msUntilMidnight())}
            </Text>
          </View>
          <View style={hdr.track}>
            <View style={[hdr.fill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          {alreadyClaimed && (
            <View style={hdr.claimedRow}>
              <Text style={hdr.claimedTxt}>✓ Today's reward claimed</Text>
            </View>
          )}
        </>
      )}

      {!isActive && (
        <Text style={hdr.price}>{PASS_MONTHLY_PRICE} / month</Text>
      )}
    </LinearGradient>
  );
}

const hdr = StyleSheet.create({
  root: {
    borderRadius: Radius.xl,
    padding: Spacing.base,
    borderWidth: 1.5,
    borderColor: '#C49A3C55',
    gap: Spacing.sm,
    ...Platform.select({
      ios: { shadowColor: '#C49A3C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 16 },
      android: { elevation: 6 },
    }),
  },
  titleRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleLeft:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  crown:      { fontSize: 28 },
  title:      { fontSize: FontSize.lg, fontWeight: FontWeight.heavy, color: '#FCD34D' },
  subtitle:   { fontSize: FontSize.xs, color: '#C49A3C', marginTop: 1 },

  badge:         { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  badgeActive:   { backgroundColor: Colors.success + '18', borderColor: Colors.success + '55' },
  badgeInactive: { backgroundColor: Colors.border + '30', borderColor: Colors.border },
  badgeTxt:      { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  badgeTxtActive:   { color: Colors.success },
  badgeTxtInactive: { color: Colors.textMuted },

  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayLabel:    { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: '#FCD34D' },
  timeLabel:   { fontSize: FontSize.xs, color: '#C49A3C' },
  track: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: '#C49A3C',
    borderRadius: 3,
  },
  claimedRow: { alignItems: 'center' },
  claimedTxt: { fontSize: FontSize.xs, color: Colors.success, fontWeight: FontWeight.semibold },
  price:      { fontSize: FontSize.base, color: '#C49A3C', fontWeight: FontWeight.bold },
});

// ─── TodayReward ─────────────────────────────────────────────────────────────

function TodayReward({
  reward,
  canClaim,
  onClaim,
  justClaimed,
}: {
  reward:       PassReward;
  canClaim:     boolean;
  onClaim:      () => void;
  justClaimed:  boolean;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    if (!canClaim) return;
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.93, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim,  { toValue: 1,    useNativeDriver: true }),
    ]).start();
    onClaim();
  };

  const claimed = !canClaim;

  return (
    <View style={td.wrapper}>
      <Text style={td.sectionLabel}>TODAY'S REWARD</Text>

      <LinearGradient
        colors={claimed ? [Colors.surfaceElevated, Colors.surfaceElevated] : ['#1A1000', '#261600']}
        style={[td.card, { borderColor: claimed ? Colors.border : '#C49A3C55' }]}
      >
        <View style={[td.iconWrap, { backgroundColor: reward.color + '22', borderColor: reward.color + '44' }]}>
          <Text style={td.icon}>{reward.icon}</Text>
        </View>

        <View style={td.info}>
          <Text style={td.rewardName}>{reward.sublabel}</Text>
          <Text style={td.rewardMeta}>
            Day {reward.day} reward
            {reward.rarity ? ` · ${reward.rarity.charAt(0).toUpperCase() + reward.rarity.slice(1)}` : ''}
          </Text>
        </View>

        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          {justClaimed ? (
            <View style={[td.claimedBadge]}>
              <Text style={td.claimedTxt}>✓ Claimed</Text>
            </View>
          ) : canClaim ? (
            <TouchableOpacity style={[td.claimBtn, { backgroundColor: reward.color }]} onPress={handlePress} activeOpacity={0.8}>
              <Text style={td.claimTxt}>Claim</Text>
            </TouchableOpacity>
          ) : (
            <View style={td.doneBadge}>
              <Text style={td.doneTxt}>✓</Text>
            </View>
          )}
        </Animated.View>
      </LinearGradient>
    </View>
  );
}

const td = StyleSheet.create({
  wrapper:     { gap: Spacing.xs },
  sectionLabel:{
    fontSize: FontSize.xs, fontWeight: FontWeight.heavy,
    color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.2,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    padding: Spacing.base,
    ...Platform.select({
      ios: { shadowColor: '#C49A3C', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 10 },
      android: { elevation: 4 },
    }),
  },
  iconWrap: {
    width: 52, height: 52, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  icon:       { fontSize: 26 },
  info:       { flex: 1, gap: 3 },
  rewardName: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.text },
  rewardMeta: { fontSize: FontSize.xs, color: Colors.textMuted },
  claimBtn: {
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    minWidth: 72,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6 },
      android: { elevation: 3 },
    }),
  },
  claimTxt: { fontSize: FontSize.sm, fontWeight: FontWeight.heavy, color: '#FFF', letterSpacing: 0.5 },
  claimedBadge: {
    backgroundColor: Colors.success + '18',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.success + '44',
    minWidth: 72,
    alignItems: 'center',
  },
  claimedTxt: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.success },
  doneBadge: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.success + '22',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.success + '44',
  },
  doneTxt: { fontSize: FontSize.base, color: Colors.success, fontWeight: FontWeight.bold },
});

// ─── RewardsGrid ──────────────────────────────────────────────────────────────

function RewardsGrid({
  passDay,
  passClaimedDays,
  alreadyClaimed,
}: {
  passDay:         number;
  passClaimedDays: number[];
  alreadyClaimed:  boolean;
}) {
  const rows: PassReward[][] = [];
  for (let i = 0; i < PASS_REWARDS.length; i += GRID_COLS) {
    rows.push(PASS_REWARDS.slice(i, i + GRID_COLS));
  }

  function variantFor(reward: PassReward): CellVariant {
    const d = reward.day;
    if (d === passDay) {
      return alreadyClaimed ? 'today-claimed' : 'today';
    }
    if (d < passDay) {
      return passClaimedDays.includes(d) ? 'claimed' : 'missed';
    }
    return 'future';
  }

  return (
    <View style={grid.wrapper}>
      <Text style={grid.sectionLabel}>30-DAY CALENDAR</Text>
      <View style={grid.card}>
        {rows.map((row, ri) => (
          <View key={ri} style={grid.row}>
            {row.map((reward) => (
              <RewardCell key={reward.day} reward={reward} variant={variantFor(reward)} />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const grid = StyleSheet.create({
  wrapper:      { gap: Spacing.xs },
  sectionLabel: {
    fontSize: FontSize.xs, fontWeight: FontWeight.heavy,
    color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.2,
  },
  card: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: GRID_PADDING,
    gap: CELL_GAP,
  },
  row: {
    flexDirection: 'row',
    gap: CELL_GAP,
  },
});

// ─── UpgradeCard ──────────────────────────────────────────────────────────────

const BENEFITS = [
  { icon: '⚡', text: 'Daily time bonus (up to +1h/day)' },
  { icon: '🃏', text: 'Cards: Common → Legendary progression' },
  { icon: '📦', text: 'Weekly crates (Basic + Premium)' },
  { icon: '👑', text: 'Legendary card on day 30' },
  { icon: '🔄', text: 'Resets every 30 days automatically' },
];

function UpgradeCard({ onActivate }: { onActivate: () => void }) {
  return (
    <View style={up.wrapper}>
      <Text style={up.sectionLabel}>GET THE PASS</Text>
      <LinearGradient
        colors={['#0F0800', '#1A1000', '#0F0800']}
        style={up.card}
      >
        {/* Preview: first 5 rewards */}
        <View style={up.previewRow}>
          {PASS_REWARDS.slice(0, 5).map((r) => (
            <View key={r.day} style={[up.previewCell, { borderColor: r.color + '44' }]}>
              <Text style={up.previewIcon}>{r.icon}</Text>
              <Text style={[up.previewLabel, { color: r.color }]}>{r.label}</Text>
            </View>
          ))}
        </View>
        <Text style={up.previewMore}>+ 25 more rewards over 30 days →</Text>

        <View style={up.divider} />

        {/* Benefits */}
        <View style={up.benefits}>
          {BENEFITS.map((b, i) => (
            <View key={i} style={up.benefitRow}>
              <Text style={up.benefitIcon}>{b.icon}</Text>
              <Text style={up.benefitText}>{b.text}</Text>
            </View>
          ))}
        </View>

        <View style={up.divider} />

        {/* Price + CTA */}
        <View style={up.priceRow}>
          <View>
            <Text style={up.price}>{PASS_MONTHLY_PRICE}</Text>
            <Text style={up.priceSub}>per month · cancel anytime</Text>
          </View>
          <TouchableOpacity
            style={up.subscribeBtn}
            activeOpacity={0.82}
            onPress={onActivate}
          >
            <Text style={up.subscribeTxt}>
              {__DEV__ ? 'Activate (DEV)' : 'Subscribe'}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
}

const up = StyleSheet.create({
  wrapper:      { gap: Spacing.xs },
  sectionLabel: {
    fontSize: FontSize.xs, fontWeight: FontWeight.heavy,
    color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.2,
  },
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderColor: '#C49A3C44',
    padding: Spacing.base,
    gap: Spacing.base,
    ...Platform.select({
      ios: { shadowColor: '#C49A3C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 16 },
      android: { elevation: 5 },
    }),
  },
  previewRow:  { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'center' },
  previewCell: {
    alignItems: 'center', gap: 3,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 8,
    flex: 1,
  },
  previewIcon:  { fontSize: 20 },
  previewLabel: { fontSize: 9, fontWeight: FontWeight.bold },
  previewMore:  { fontSize: FontSize.xs, color: '#C49A3C', textAlign: 'center' },
  divider:      { height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  benefits:     { gap: Spacing.sm },
  benefitRow:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  benefitIcon:  { fontSize: 16, width: 22, textAlign: 'center' },
  benefitText:  { fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1 },
  priceRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  price:        { fontSize: FontSize['2xl'], fontWeight: FontWeight.heavy, color: '#FCD34D' },
  priceSub:     { fontSize: FontSize.xs, color: '#C49A3C', marginTop: 1 },
  subscribeBtn: {
    backgroundColor: '#C49A3C',
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    ...Platform.select({
      ios: { shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.5, shadowRadius: 10 },
      android: { elevation: 4 },
    }),
  },
  subscribeTxt: { fontSize: FontSize.base, fontWeight: FontWeight.heavy, color: '#0A0600' },
});

// ─── Main export ──────────────────────────────────────────────────────────────

export function DailyPass() {
  const {
    isPassActive,
    passStartDate,
    passLastClaimDate,
    passClaimedDays,
    activatePass,
    claimPassDay,
    addCard,
    addCrate,
  } = useGameStore();
  const { addTime } = useTimeStore();

  const [justClaimed, setJustClaimed] = useState(false);

  const today        = todayStr();
  const passDay      = computePassDay(passStartDate);
  const todayReward  = PASS_REWARDS[passDay - 1];   // 0-indexed
  const alreadyClaimed = justClaimed || passLastClaimDate === today;
  const canClaim       = isPassActive && !alreadyClaimed && passDay <= 30;

  const handleClaim = () => {
    if (!canClaim) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Apply reward to the appropriate store
    const r = todayReward;
    if (r.kind === 'time' && r.seconds) {
      addTime(r.seconds);
    } else if (r.kind === 'card') {
      if (__DEV__) addCard(makeMockCard(r) as any);
    } else if (r.kind === 'crate') {
      addCrate(makeMockCrate(r));
    }

    // Persist to store
    claimPassDay(passDay);
    setJustClaimed(true);
  };

  const handleActivate = () => {
    // In production: trigger in-app purchase / subscription flow
    if (__DEV__) activatePass();
  };

  return (
    <View style={main.root}>
      {/* ── Status header ── */}
      <PassHeader
        isActive={isPassActive}
        passDay={passDay}
        alreadyClaimed={alreadyClaimed}
      />

      {/* ── Active pass content ── */}
      {isPassActive && (
        <>
          <TodayReward
            reward={todayReward}
            canClaim={canClaim}
            onClaim={handleClaim}
            justClaimed={justClaimed}
          />
          <RewardsGrid
            passDay={passDay}
            passClaimedDays={passClaimedDays}
            alreadyClaimed={alreadyClaimed}
          />
        </>
      )}

      {/* ── Upgrade card (inactive) ── */}
      {!isPassActive && <UpgradeCard onActivate={handleActivate} />}
    </View>
  );
}

const main = StyleSheet.create({
  root: { gap: Spacing.lg },
});
