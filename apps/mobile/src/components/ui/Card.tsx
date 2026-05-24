import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { Colors, Radius, Spacing, Shadow } from '../../theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  elevated?: boolean;
  highlighted?: boolean;
}

export function Card({ children, style, elevated, highlighted }: CardProps) {
  return (
    <View
      style={[
        styles.card,
        elevated && styles.elevated,
        highlighted && styles.highlighted,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  elevated: {
    ...Shadow.md,
    backgroundColor: Colors.surfaceHighlight,
  },
  highlighted: {
    borderColor: Colors.primary,
    borderWidth: 1.5,
  },
});
