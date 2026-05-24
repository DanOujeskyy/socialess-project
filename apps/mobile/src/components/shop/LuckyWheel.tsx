import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../theme';
import { SPIN_WHEEL_ITEMS } from '../../constants';
import type { SpinReward } from '../../types';

interface LuckyWheelProps {
  onSpin: () => Promise<SpinReward>;
  canSpin: boolean;
}

const SEGMENT_COUNT = SPIN_WHEEL_ITEMS.length;
const SEGMENT_ANGLE = 360 / SEGMENT_COUNT;

export function LuckyWheel({ onSpin, canSpin }: LuckyWheelProps) {
  const spinAnim = useRef(new Animated.Value(0)).current;
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SpinReward | null>(null);
  const currentRotation = useRef(0);

  const handleSpin = async () => {
    if (spinning || !canSpin) return;
    setSpinning(true);
    setResult(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      const reward = await onSpin();
      const segmentIndex = SPIN_WHEEL_ITEMS.findIndex((s) => s.type === reward.type);
      const targetDeg = 360 * 5 + (segmentIndex >= 0 ? (360 - segmentIndex * SEGMENT_ANGLE) : 0);
      const totalDeg = currentRotation.current + targetDeg;
      currentRotation.current = totalDeg % 360;

      Animated.timing(spinAnim, {
        toValue: totalDeg,
        duration: 3500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setResult(reward);
        setSpinning(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      });
    } catch {
      setSpinning(false);
    }
  };

  const rotation = spinAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
    extrapolate: 'extend',
  });

  return (
    <View style={styles.container}>
      <View style={styles.pointer} />
      <Animated.View style={[styles.wheel, { transform: [{ rotate: rotation }] }]}>
        {SPIN_WHEEL_ITEMS.map((segment, i) => (
          <View
            key={i}
            style={[
              styles.segment,
              {
                transform: [{ rotate: `${i * SEGMENT_ANGLE}deg` }],
                backgroundColor: segment.color,
              },
            ]}
          >
            <Text style={styles.segmentLabel}>{segment.label}</Text>
          </View>
        ))}
      </Animated.View>

      <TouchableOpacity
        style={[styles.spinBtn, (!canSpin || spinning) && styles.spinBtnDisabled]}
        onPress={handleSpin}
        disabled={!canSpin || spinning}
      >
        <Text style={styles.spinText}>{spinning ? 'Spinning…' : 'SPIN'}</Text>
      </TouchableOpacity>

      {result && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultLabel}>You won:</Text>
          <Text style={styles.resultValue}>{result.label}</Text>
        </View>
      )}

      {!canSpin && !spinning && (
        <Text style={styles.noSpinText}>Come back tomorrow for a free spin!</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: Spacing.lg },
  pointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 20,
    borderLeftColor: Colors.transparent,
    borderRightColor: Colors.transparent,
    borderBottomColor: Colors.warning,
    marginBottom: -10,
    zIndex: 10,
  },
  wheel: {
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 3,
    borderColor: Colors.border,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: Colors.surface,
  },
  segment: {
    position: 'absolute',
    width: '50%',
    height: '50%',
    left: '50%',
    top: 0,
    transformOrigin: 'bottom left',
    justifyContent: 'flex-start',
    paddingTop: 12,
    paddingLeft: 8,
    opacity: 0.9,
  },
  segmentLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.text,
    transform: [{ rotate: `${SEGMENT_ANGLE / 2}deg` }],
  },
  spinBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
    marginTop: Spacing.md,
  },
  spinBtnDisabled: { opacity: 0.45 },
  spinText: { fontSize: FontSize.lg, fontWeight: FontWeight.heavy, color: Colors.text, letterSpacing: 1.5 },
  resultContainer: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.success + '55',
  },
  resultLabel: { fontSize: FontSize.sm, color: Colors.textMuted },
  resultValue: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.success },
  noSpinText: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },
});
