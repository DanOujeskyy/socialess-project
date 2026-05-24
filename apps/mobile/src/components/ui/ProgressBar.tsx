import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, type ViewStyle } from 'react-native';
import { Colors, Radius } from '../../theme';

interface ProgressBarProps {
  value: number; // 0–1
  color?: string;
  backgroundColor?: string;
  height?: number;
  animated?: boolean;
  style?: ViewStyle;
}

export function ProgressBar({
  value,
  color = Colors.primary,
  backgroundColor = Colors.border,
  height = 8,
  animated = true,
  style,
}: ProgressBarProps) {
  const widthAnim = useRef(new Animated.Value(value)).current;

  useEffect(() => {
    if (animated) {
      Animated.timing(widthAnim, {
        toValue: Math.min(1, Math.max(0, value)),
        duration: 600,
        useNativeDriver: false,
      }).start();
    } else {
      widthAnim.setValue(Math.min(1, Math.max(0, value)));
    }
  }, [value]);

  const getColor = () => {
    if (value < 0.15) return Colors.danger;
    if (value < 0.35) return Colors.warning;
    return color;
  };

  return (
    <View style={[{ height, backgroundColor, borderRadius: Radius.full, overflow: 'hidden' }, style]}>
      <Animated.View
        style={{
          height: '100%',
          backgroundColor: getColor(),
          borderRadius: Radius.full,
          width: widthAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['0%', '100%'],
          }),
        }}
      />
    </View>
  );
}
