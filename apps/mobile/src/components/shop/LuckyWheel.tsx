import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
  Alert,
} from 'react-native';
import Svg, { Path, Circle, Text as SvgText } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../theme';
import { SPIN_WHEEL_ITEMS } from '../../constants';
import type { SpinReward } from '../../types';

// ── Wheel geometry ─────────────────────────────────────────────────────────────

const WHEEL_SIZE    = 310;
const CX            = WHEEL_SIZE / 2;
const CY            = WHEEL_SIZE / 2;
const OUTER_RADIUS  = 142;
const INNER_RADIUS  = 26;

// Build segment list — optionally filter to time-only for solo mode
function buildSegs(soloMode: boolean) {
  const items = soloMode
    ? SPIN_WHEEL_ITEMS.filter((i) => i.type === 'time' || i.type === 'extra_spin')
    : SPIN_WHEEL_ITEMS;
  const totalW = items.reduce((s, i) => s + i.weight, 0);
  let cum = 0;
  return items.map((item) => {
    const span  = (item.weight / totalW) * 360;
    const start = cum;
    const end   = cum + span;
    const mid   = (start + end) / 2;
    const pct   = Math.round((item.weight / totalW) * 100);
    cum += span;
    return { ...item, start, end, mid, span, pct };
  });
}

// Segment light tint for alternating depth
const LIGHT_FACTOR = 0.18;
function lighten(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, ((n >> 16) & 255) + Math.round(255 * LIGHT_FACTOR));
  const g = Math.min(255, ((n >> 8)  & 255) + Math.round(255 * LIGHT_FACTOR));
  const b = Math.min(255,  (n & 255)        + Math.round(255 * LIGHT_FACTOR));
  return `rgb(${r},${g},${b})`;
}

// ── SVG helpers ────────────────────────────────────────────────────────────────

function polarXY(r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

function slicePath(r: number, start: number, end: number): string {
  const s = polarXY(r, start);
  const e = polarXY(r, end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${CX.toFixed(1)} ${CY.toFixed(1)} L ${s.x.toFixed(1)} ${s.y.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(1)} ${e.y.toFixed(1)} Z`;
}

// Short display labels (max 2 lines)
const SEG_LINES: Record<string, string[]> = {
  '+10 Min':       ['+10', 'Min'],
  'Basic Crate':   ['Crate'],
  '+5 Min':        ['+5', 'Min'],
  'Random Card':   ['Card'],
  'Extra Spin':    ['Extra', 'Spin'],
  'Premium Crate': ['Premium'],
};

// ── Types ──────────────────────────────────────────────────────────────────────

type Seg = ReturnType<typeof buildSegs>[0];

// ── Mock spin reward (dev fallback) ───────────────────────────────────────────

function mockSpin(segs: Seg[]): SpinReward {
  const idx = Math.floor(Math.random() * segs.length);
  const seg = segs[idx];
  return {
    type:  seg.type,
    label: seg.label,
    value: ('value' in seg ? seg.value : null) as any,
  };
}

// ── Prize table item ───────────────────────────────────────────────────────────

function PrizePill({ seg }: { seg: Seg }) {
  return (
    <View style={[pz.pill, { borderColor: seg.color + '55', backgroundColor: seg.color + '14' }]}>
      <View style={[pz.dot, { backgroundColor: seg.color }]} />
      <Text style={pz.label}>{seg.label}</Text>
      <Text style={[pz.pct, { color: seg.color }]}>{seg.pct}%</Text>
    </View>
  );
}
const pz = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  dot:   { width: 7, height: 7, borderRadius: 4 },
  label: { fontSize: 11, fontWeight: '600', color: Colors.text },
  pct:   { fontSize: 11, fontWeight: '700' },
});

// ── Component ──────────────────────────────────────────────────────────────────

interface LuckyWheelProps {
  onSpin:       () => Promise<SpinReward>;
  hasSpunToday: boolean;
  onSpunToday:  () => void;
  soloMode?:    boolean;
}

export function LuckyWheel({ onSpin, hasSpunToday, onSpunToday, soloMode = false }: LuckyWheelProps) {
  const SEGS = buildSegs(soloMode);

  const spinAnim       = useRef(new Animated.Value(0)).current;
  const totalRotation  = useRef(0);

  const [phase,   setPhase]   = useState<'idle' | 'ad' | 'ready' | 'spinning' | 'done'>('idle');
  const [winIdx,  setWinIdx]  = useState<number | null>(null);
  const [result,  setResult]  = useState<SpinReward | null>(null);

  // ── Watch ad flow ─────────────────────────────────────────────────────────

  const handleWatchAd = () => {
    // In production: show a real rewarded ad (AdMob etc.)
    // In dev: simulate with a dialog
    Alert.alert(
      '📺 Rewarded Ad',
      __DEV__
        ? '[DEV] Simulate watching a 30s ad to unlock your daily spin.'
        : 'Watch a short ad to unlock your daily spin for free.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: __DEV__ ? 'Simulate Ad' : 'Watch Ad',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setPhase('ready');
          },
        },
      ],
    );
  };

  // ── Spin logic ────────────────────────────────────────────────────────────

  const handleSpin = async () => {
    if (phase !== 'ready') return;
    setPhase('spinning');
    setResult(null);
    setWinIdx(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    let reward: SpinReward;
    try {
      reward = await onSpin();
    } catch {
      reward = __DEV__ ? mockSpin(SEGS) : (() => { setPhase('ready'); return null; })()!;
      if (!reward) return;
    }

    let idx = SEGS.findIndex((s) => s.label === reward.label);
    if (idx < 0) idx = SEGS.findIndex((s) => s.type  === reward.type);
    if (idx < 0) idx = 0;

    const centerAngle = SEGS[idx].mid;
    const currentMod  = totalRotation.current % 360;
    const offset      = ((centerAngle - currentMod) + 360) % 360;
    totalRotation.current += 1800 + offset;

    Animated.timing(spinAnim, {
      toValue:  totalRotation.current,
      duration: 4000,
      easing:   Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setWinIdx(idx);
      setResult(reward);
      setPhase('done');
      onSpunToday();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    });
  };

  const rotation = spinAnim.interpolate({
    inputRange: [0, 360], outputRange: ['0deg', '360deg'], extrapolate: 'extend',
  });

  const winColor = winIdx !== null ? SEGS[winIdx].color : Colors.success;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={st.root}>

      {/* ── Pointer ── */}
      <View style={st.pointerWrap} pointerEvents="none">
        <View style={st.pointer} />
        <View style={st.pointerStem} />
      </View>

      {/* ── Wheel container ── */}
      <View style={st.wheelOuter}>
        {/* Rotating SVG */}
        <View style={st.wheelClip}>
          <Animated.View style={{ transform: [{ rotate: rotation }] }}>
            <Svg width={WHEEL_SIZE} height={WHEEL_SIZE}>
              {SEGS.map((seg, i) => {
                const dimmed = phase === 'done' && winIdx !== null && winIdx !== i;
                const lp     = polarXY(OUTER_RADIUS * 0.65, seg.mid);
                const lines  = SEG_LINES[seg.label] ?? [seg.label];

                return (
                  <React.Fragment key={i}>
                    <Path
                      d={slicePath(OUTER_RADIUS, seg.start, seg.end)}
                      fill={i % 2 === 0 ? seg.color : lighten(seg.color)}
                      stroke={Colors.background}
                      strokeWidth={1.8}
                      opacity={dimmed ? 0.35 : 1}
                    />
                    {lines.map((line, li) => (
                      <SvgText
                        key={li}
                        x={lp.x}
                        y={lp.y + li * 10 - (lines.length - 1) * 5}
                        fontSize={seg.span < 30 ? 8 : 10}
                        fontWeight="700"
                        fill="#FFFFFF"
                        fillOpacity={dimmed ? 0.4 : 1}
                        textAnchor="middle"
                        alignmentBaseline="middle"
                        transform={`rotate(${seg.mid}, ${lp.x}, ${lp.y})`}
                      >
                        {line}
                      </SvgText>
                    ))}
                  </React.Fragment>
                );
              })}
            </Svg>
          </Animated.View>
        </View>

        {/* Static overlay: border ring + center */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width={WHEEL_SIZE} height={WHEEL_SIZE}>
            {/* Outer decorative ring */}
            <Circle cx={CX} cy={CY} r={OUTER_RADIUS + 2} fill="none" stroke="#C49A3C" strokeWidth={5} />
            <Circle cx={CX} cy={CY} r={OUTER_RADIUS + 6} fill="none" stroke="#C49A3C33" strokeWidth={2} />
            {/* Center knob */}
            <Circle cx={CX} cy={CY} r={INNER_RADIUS + 4} fill="#1A1208" stroke="#C49A3C" strokeWidth={2.5} />
            <Circle cx={CX} cy={CY} r={INNER_RADIUS}     fill="#2A1E0A" />
            <SvgText x={CX} y={CY + 1} fontSize={14} textAnchor="middle" alignmentBaseline="middle" fill="#FCD34D" fontWeight="800">★</SvgText>
          </Svg>
        </View>
      </View>

      {/* ── CTA area ── */}
      {phase === 'idle' && !hasSpunToday && (
        <TouchableOpacity style={st.adBtn} onPress={handleWatchAd} activeOpacity={0.82}>
          <Text style={st.adBtnIcon}>📺</Text>
          <View>
            <Text style={st.adBtnTitle}>Watch Ad · Spin Today</Text>
            <Text style={st.adBtnSub}>One free spin per day</Text>
          </View>
        </TouchableOpacity>
      )}

      {phase === 'ready' && (
        <TouchableOpacity style={st.spinBtn} onPress={handleSpin} activeOpacity={0.82}>
          <Text style={st.spinText}>SPIN NOW</Text>
        </TouchableOpacity>
      )}

      {phase === 'spinning' && (
        <View style={st.spinBtn}>
          <Text style={st.spinText}>· · ·</Text>
        </View>
      )}

      {(phase === 'done' || hasSpunToday) && !result && (
        <View style={st.doneBox}>
          <Text style={st.doneIcon}>✅</Text>
          <Text style={st.doneText}>Spun today</Text>
          <Text style={st.doneSub}>Come back tomorrow for your next spin</Text>
        </View>
      )}

      {/* ── Result banner ── */}
      {result && winIdx !== null && (
        <View style={[st.resultBox, { borderColor: winColor + '99' }]}>
          <Text style={st.resultEmoji}>🎉</Text>
          <View>
            <Text style={st.resultHdr}>You won</Text>
            <Text style={[st.resultVal, { color: winColor }]}>{result.label}</Text>
          </View>
        </View>
      )}

      {/* ── Prize table ── */}
      <View style={st.prizeSection}>
        <Text style={st.prizeSectionTitle}>Prizes</Text>
        <View style={st.prizeGrid}>
          {SEGS.map((seg) => <PrizePill key={seg.label} seg={seg} />)}
        </View>
      </View>

    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  root: { alignItems: 'center', gap: Spacing.lg },

  pointerWrap: { alignItems: 'center', marginBottom: -18, zIndex: 10 },
  pointer: {
    width: 0, height: 0,
    borderLeftWidth: 14, borderRightWidth: 14,
    borderBottomWidth: 26,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderBottomColor: '#FCD34D',
    ...Platform.select({
      ios: { shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.9, shadowRadius: 8 },
    }),
  },
  pointerStem: {
    width: 4, height: 10,
    backgroundColor: '#FCD34D',
    borderBottomLeftRadius: 2, borderBottomRightRadius: 2,
    marginTop: -1,
  },

  wheelOuter: {
    width: WHEEL_SIZE, height: WHEEL_SIZE,
    position: 'relative',
    ...Platform.select({
      ios: { shadowColor: '#C49A3C', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.45, shadowRadius: 28 },
      android: { elevation: 12 },
    }),
  },
  wheelClip: {
    width: WHEEL_SIZE, height: WHEEL_SIZE,
    borderRadius: WHEEL_SIZE / 2,
    overflow: 'hidden',
  },

  adBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderColor: '#C49A3C66',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    minWidth: 240,
    ...Platform.select({
      ios: { shadowColor: '#C49A3C', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 10 },
      android: { elevation: 4 },
    }),
  },
  adBtnIcon:  { fontSize: 26 },
  adBtnTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.text },
  adBtnSub:   { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },

  spinBtn: {
    backgroundColor: '#C49A3C',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing['3xl'],
    paddingVertical: Spacing.md,
    minWidth: 200,
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.6, shadowRadius: 12 },
      android: { elevation: 6 },
    }),
  },
  spinText: {
    fontSize: FontSize.lg, fontWeight: FontWeight.heavy,
    color: '#0A0A0F', letterSpacing: 3,
  },

  doneBox: { alignItems: 'center', gap: 4 },
  doneIcon: { fontSize: 28 },
  doneText: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.text },
  doneSub:  { fontSize: FontSize.sm, color: Colors.textMuted },

  resultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderWidth: 2,
    minWidth: 240,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
      android: { elevation: 5 },
    }),
  },
  resultEmoji: { fontSize: 32 },
  resultHdr:   { fontSize: FontSize.xs, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  resultVal:   { fontSize: FontSize['2xl'], fontWeight: FontWeight.heavy },

  prizeSection:      { width: '100%', gap: Spacing.sm },
  prizeSectionTitle: {
    fontSize: FontSize.xs, fontWeight: FontWeight.heavy,
    color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.2,
  },
  prizeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
});
