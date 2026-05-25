import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
  type TextInputProps,
} from 'react-native';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../theme';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

export interface FormFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string | null;
  touched?: boolean;
  placeholder?: string;
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: () => void;
  onBlur?: () => void;
  editable?: boolean;
  secureTextEntry?: boolean;
  hint?: string;
  rightElement?: React.ReactNode;
  inputRef?: React.RefObject<TextInput | null>;
}

export function FormField({
  label,
  value,
  onChangeText,
  error,
  touched,
  placeholder,
  keyboardType = 'default',
  autoCapitalize = 'none',
  autoComplete,
  returnKeyType = 'next',
  onSubmitEditing,
  onBlur,
  editable = true,
  secureTextEntry = false,
  hint,
  rightElement,
  inputRef,
}: FormFieldProps) {
  const [focused, setFocused] = useState(false);
  const internalRef = useRef<TextInput>(null);
  const ref = inputRef ?? internalRef;

  const showError = touched && !!error;
  const showValid = touched && !error && value.length > 0;

  const borderColor = showError
    ? Colors.danger
    : showValid
    ? Colors.success
    : focused
    ? Colors.primary
    : Colors.border;

  const handleBlur = () => {
    setFocused(false);
    onBlur?.();
  };

  const prevError = useRef<string | null | undefined>(error);
  if (prevError.current !== error) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    prevError.current = error;
  }

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, { borderColor }]}>
        <TextInput
          ref={ref}
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
          placeholder={placeholder}
          placeholderTextColor={Colors.textDisabled}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          editable={editable}
          secureTextEntry={secureTextEntry}
          autoCorrect={false}
        />
        {rightElement}
      </View>
      {showError && (
        <View style={styles.errorRow}>
          <Text style={styles.errorIcon}>⚠</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      {!showError && hint && (
        <Text style={styles.hint}>{hint}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.xs },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.textSecondary,
    marginLeft: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.base,
    minHeight: 52,
  },
  input: {
    flex: 1,
    fontSize: FontSize.base,
    color: Colors.text,
    paddingVertical: Spacing.md,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginLeft: 2,
  },
  errorIcon: {
    fontSize: 11,
    color: Colors.danger,
  },
  errorText: {
    fontSize: FontSize.sm,
    color: Colors.danger,
    flex: 1,
  },
  hint: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginLeft: 2,
  },
});
