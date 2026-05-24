import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  type TouchableOpacityProps,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../theme';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size    = 'sm' | 'md' | 'lg';

interface ButtonProps extends TouchableOpacityProps {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  style,
  textStyle,
  onPress,
  disabled,
  ...rest
}: ButtonProps) {
  const handlePress = (e: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.(e);
  };

  return (
    <TouchableOpacity
      style={[
        styles.base,
        styles[variant],
        styles[`size_${size}`],
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
        style,
      ]}
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'ghost' ? Colors.primary : Colors.text}
          size="small"
        />
      ) : (
        <Text style={[styles.label, styles[`labelVariant_${variant}`], styles[`labelSize_${size}`], textStyle]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.lg,
    flexDirection: 'row',
  },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.45 },

  primary: { backgroundColor: Colors.primary },
  secondary: { backgroundColor: Colors.secondary },
  outline: {
    backgroundColor: Colors.transparent,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  ghost: { backgroundColor: 'rgba(108, 92, 231, 0.12)' },
  danger: { backgroundColor: Colors.danger },

  size_sm: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, minHeight: 36 },
  size_md: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, minHeight: 48 },
  size_lg: { paddingHorizontal: Spacing['2xl'], paddingVertical: Spacing.base, minHeight: 56 },

  label: { fontWeight: FontWeight.semibold, letterSpacing: 0.3 },
  labelVariant_primary:   { color: Colors.text },
  labelVariant_secondary: { color: Colors.background },
  labelVariant_outline:   { color: Colors.primary },
  labelVariant_ghost:     { color: Colors.primary },
  labelVariant_danger:    { color: Colors.text },

  labelSize_sm: { fontSize: FontSize.sm },
  labelSize_md: { fontSize: FontSize.base },
  labelSize_lg: { fontSize: FontSize.lg },
});
