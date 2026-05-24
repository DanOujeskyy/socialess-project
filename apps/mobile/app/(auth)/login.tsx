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

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error, clearError } = useAuthStore();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace('/(app)/(tabs)/');
    } catch {
      // Error shown via store
    }
  };

  return (
    <LinearGradient colors={[Colors.background, '#0D0D1A']} style={styles.gradient}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[styles.container, { paddingTop: insets.top + Spacing['2xl'] }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.logo}>📵</Text>
            <Text style={styles.appName}>Socialess</Text>
            <Text style={styles.tagline}>Break free. Earn your time.</Text>
          </View>

          <View style={styles.form}>
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity onPress={clearError}><Text style={styles.errorClose}>✕</Text></TouchableOpacity>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                placeholderTextColor={Colors.textDisabled}
                placeholder="your@email.com"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
                placeholderTextColor={Colors.textDisabled}
                placeholder="••••••••"
                onSubmitEditing={handleLogin}
              />
            </View>

            <Button
              label="Sign In"
              onPress={handleLogin}
              loading={isLoading}
              fullWidth
              size="lg"
              style={styles.submitBtn}
            />

            <TouchableOpacity onPress={() => router.push('/(auth)/register')} style={styles.switchLink}>
              <Text style={styles.switchText}>
                Don't have an account? <Text style={styles.switchHighlight}>Sign Up</Text>
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
  container: { flexGrow: 1, padding: Spacing.xl, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: Spacing['4xl'] },
  logo: { fontSize: 64, marginBottom: Spacing.md },
  appName: {
    fontSize: FontSize['4xl'],
    fontWeight: FontWeight.heavy,
    color: Colors.text,
    letterSpacing: -1,
  },
  tagline: { fontSize: FontSize.base, color: Colors.textMuted, marginTop: Spacing.xs },
  form: { gap: Spacing.base },
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
