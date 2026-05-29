import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedProps,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle, G, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { Colors, FontSize, FontWeight } from '../../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RADIUS = 80;
const STROKE_W = 16;
const CIRC = 2 * Math.PI * RADIUS;
const SIZE = (RADIUS + STROKE_W) * 2 + 8;

function fmtTime(s: number): string {
  if (s <= 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function ringColor(p: number): string {
  if (p < 0.5) return Colors.success;
  if (p < 0.8) return Colors.warning;
  return Colors.danger;
}

interface Props {
  usedSeconds: number;
  totalSeconds: number;
  remainingSeconds: number;
  earnedSeconds: number;
}

export function BudgetRing({ usedSeconds, totalSeconds, remainingSeconds, earnedSeconds }: Props) {
  const progress = totalSeconds > 0 ? Math.min(1, usedSeconds / totalSeconds) : 0;
  const earnedProgress = totalSeconds > 0 ? Math.min(1, earnedSeconds / totalSeconds) : 0;

  const progressSV = useSharedValue(0);
  const earnedSV = useSharedValue(0);

  useEffect(() => {
    progressSV.value = withTiming(progress, {
      duration: 1400,
      easing: Easing.out(Easing.cubic),
    });
    earnedSV.value = withTiming(earnedProgress, {
      duration: 1600,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, earnedProgress]);

  const usedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRC * (1 - progressSV.value),
  }));

  const earnedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRC * (1 - earnedSV.value),
  }));

  const color = ringColor(progress);
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const pct = Math.round(progress * 100);

  return (
    <View style={styles.container}>
      <Svg width={SIZE} height={SIZE}>
        <Defs>
          <SvgGradient id="earnedGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={Colors.success} stopOpacity="0.5" />
            <Stop offset="1" stopColor={Colors.success} stopOpacity="0.2" />
          </SvgGradient>
        </Defs>

        {/* Outermost dim track */}
        <Circle
          cx={cx} cy={cy} r={RADIUS}
          stroke={Colors.surfaceElevated}
          strokeWidth={STROKE_W}
          fill="transparent"
        />

        {/* Earned time arc (outer, wider, dim green) */}
        <G rotation={-90} origin={`${cx}, ${cy}`}>
          <AnimatedCircle
            cx={cx} cy={cy} r={RADIUS}
            stroke={Colors.success + '38'}
            strokeWidth={STROKE_W + 6}
            strokeDasharray={CIRC}
            animatedProps={earnedProps}
            strokeLinecap="butt"
            fill="transparent"
          />
        </G>

        {/* Main usage arc */}
        <G rotation={-90} origin={`${cx}, ${cy}`}>
          <AnimatedCircle
            cx={cx} cy={cy} r={RADIUS}
            stroke={color}
            strokeWidth={STROKE_W}
            strokeDasharray={CIRC}
            animatedProps={usedProps}
            strokeLinecap="round"
            fill="transparent"
          />
        </G>
      </Svg>

      {/* Center overlay */}
      <View style={styles.centerWrap}>
        <Text style={[styles.timeValue, { color }]}>{fmtTime(remainingSeconds)}</Text>
        <Text style={styles.timeLabel}>remaining</Text>
        <View style={styles.pctBadge}>
          <Text style={styles.pctText}>{pct}% used</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerWrap: {
    position: 'absolute',
    alignItems: 'center',
    gap: 2,
  },
  timeValue: {
    fontSize: FontSize['4xl'],
    fontWeight: FontWeight.heavy,
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  timeLabel: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  pctBadge: {
    marginTop: 6,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  pctText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
});
