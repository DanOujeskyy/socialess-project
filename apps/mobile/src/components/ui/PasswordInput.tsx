import React, { useState, useRef } from 'react';
import { TouchableOpacity, View, Text, StyleSheet, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FormField, type FormFieldProps } from './FormField';
import { getPasswordStrength, STRENGTH_LABEL, type PasswordStrength } from '../../validation/auth';
import { Colors, FontSize, Spacing } from '../../theme';

const STRENGTH_COLOR: Record<PasswordStrength, string> = {
  0: Colors.border,
  1: Colors.danger,
  2: Colors.warning,
  3: Colors.info,
  4: Colors.success,
};

interface PasswordInputProps extends Omit<FormFieldProps, 'keyboardType' | 'autoCapitalize'> {
  showStrength?: boolean;
}

export function PasswordInput({ showStrength = false, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const strength = showStrength ? getPasswordStrength(props.value) : 0;

  const eyeButton = (
    <TouchableOpacity
      onPress={() => setVisible(v => !v)}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={styles.eyeBtn}
    >
      <Ionicons
        name={visible ? 'eye-off-outline' : 'eye-outline'}
        size={20}
        color={Colors.textMuted}
      />
    </TouchableOpacity>
  );

  return (
    <View>
      <FormField
        {...props}
        keyboardType="default"
        autoCapitalize="none"
        autoComplete={props.autoComplete ?? 'password'}
        secureTextEntry={!visible}
        rightElement={eyeButton}
      />
      {showStrength && props.value.length > 0 && (
        <View style={styles.strengthContainer}>
          <View style={styles.bars}>
            {([1, 2, 3, 4] as PasswordStrength[]).map(level => (
              <View
                key={level}
                style={[
                  styles.bar,
                  { backgroundColor: strength >= level ? STRENGTH_COLOR[strength] : Colors.border },
                ]}
              />
            ))}
          </View>
          {strength > 0 && (
            <Text style={[styles.strengthLabel, { color: STRENGTH_COLOR[strength] }]}>
              {STRENGTH_LABEL[strength]}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  eyeBtn: { paddingLeft: Spacing.sm },
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 6,
    marginLeft: 2,
  },
  bars: { flexDirection: 'row', gap: 4, flex: 1 },
  bar: { flex: 1, height: 3, borderRadius: 99 },
  strengthLabel: { fontSize: FontSize.xs, fontWeight: '600' as const, minWidth: 36, textAlign: 'right' },
});
