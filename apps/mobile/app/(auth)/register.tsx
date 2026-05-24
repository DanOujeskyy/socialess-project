import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../src/store/auth.store';
import { Button } from '../../src/components/ui/Button';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../src/theme';

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail]         = useState('');
  const [username, setUsername]   = useState('');
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const { register, isLoading, error, clearError } = useAuthStore();

  const handleRegister = async () => {
    if (!email.trim() || !username.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Password mismatch', 'Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Weak password', 'Password must be at least 8 characters.');
      return;
    }
    try {
      await register(email.trim().toLowerCase(), username.trim(), password);
      router.replace('/(app)/(tabs)/');
    } catch {
      // Error shown via store
    }
  };

  return (
    <LinearGradient colors={[Colors.background, '#0D0D1A']} style={styles.gradient}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView
          contentContainerStyle={[styles.container, { paddingTop: insets.top + Spacing.xl }]}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join and start your digital detox journey</Text>
          </View>

          <View style={styles.form}>
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity onPress={clearError}><Text style={styles.errorClose}>✕</Text></TouchableOpacity>
              </View>
            )}

            {(
              [
                { label: 'Email',           value: email,    setter: setEmail,    type: 'email-address', secure: false, placeholder: 'your@email.com' },
                { label: 'Username',        value: username, setter: setUsername, type: 'default',       secure: false, placeholder: 'your_username' },
                { label: 'Password',        value: password, setter: setPassword, type: 'default',       secure: true,  placeholder: '••••••••' },
                { label: 'Confirm Password',value: confirm,  setter: setConfirm,  type: 'default',       secure: true,  placeholder: '••••••••' },
              ] as const
            ).map(({ label, value, setter, type, secure, placeholder }) => (
              <View key={label} style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{label}</Text>
                <TextInput
                  style={styles.input}
                  value={value}
                  onChangeText={setter as (v: string) => void}
                  keyboardType={type as any}
                  autoCapitalize="none"
                  secureTextEntry={secure}
                  placeholderTextColor={Colors.textDisabled}
                  placeholder={placeholder}
                />
              </View>
            ))}

            <Button
              label="Create Account"
              onPress={handleRegister}
              loading={isLoading}
              fullWidth
              size="lg"
              style={styles.submitBtn}
            />

            <TouchableOpacity onPress={() => router.back()} style={styles.switchLink}>
              <Text style={styles.switchText}>
                Already have an account? <Text style={styles.switchHighlight}>Sign In</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  flex: { flex: 1 },
  container: { flexGrow: 1, padding: Spacing.xl },
  backBtn: { marginBottom: Spacing.base },
  backText: { fontSize: FontSize.base, color: Colors.primary },
  header: { marginBottom: Spacing['2xl'] },
  title: { fontSize: FontSize['3xl'], fontWeight: FontWeight.heavy, color: Colors.text, marginBottom: Spacing.xs },
  subtitle: { fontSize: FontSize.base, color: Colors.textMuted },
  form: { gap: Spacing.md },
  errorBox: {
    backgroundColor: Colors.danger + '22',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.danger + '44',
  },
  errorText: { flex: 1, color: Colors.danger, fontSize: FontSize.sm },
  errorClose: { color: Colors.danger, fontSize: FontSize.base, paddingLeft: Spacing.sm },
  inputGroup: { gap: Spacing.xs },
  inputLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textSecondary },
  input: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    fontSize: FontSize.base,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  submitBtn: { marginTop: Spacing.sm },
  switchLink: { alignItems: 'center', paddingVertical: Spacing.sm },
  switchText: { fontSize: FontSize.sm, color: Colors.textMuted },
  switchHighlight: { color: Colors.primary, fontWeight: FontWeight.semibold },
});
