import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/auth.store';
import { Button } from '../../src/components/ui/Button';
import { FormField } from '../../src/components/ui/FormField';
import { PasswordInput } from '../../src/components/ui/PasswordInput';
import { SocialAuthButtons } from '../../src/components/auth/SocialAuthButtons';
import {
  validateEmail,
  validateUsername,
  validatePassword,
  validatePasswordConfirm,
} from '../../src/validation/auth';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../src/theme';

type Fields = { email: boolean; username: boolean; password: boolean; confirm: boolean };

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail]       = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [touched, setTouched]   = useState<Fields>({ email: false, username: false, password: false, confirm: false });

  const usernameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef  = useRef<TextInput>(null);

  const { register, googleLogin, appleLogin, isLoading, error, clearError } = useAuthStore();

  const emailError    = touched.email    ? validateEmail(email)                          : null;
  const usernameError = touched.username ? validateUsername(username)                    : null;
  const passwordError = touched.password ? validatePassword(password)                   : null;
  const confirmError  = touched.confirm  ? validatePasswordConfirm(password, confirm)   : null;

  const touch = (field: keyof Fields) => setTouched(t => ({ ...t, [field]: true }));
  const touchAll = () => setTouched({ email: true, username: true, password: true, confirm: true });

  const handleRegister = async () => {
    touchAll();
    const eErr = validateEmail(email);
    const uErr = validateUsername(username);
    const pErr = validatePassword(password);
    const cErr = validatePasswordConfirm(password, confirm);
    if (eErr || uErr || pErr || cErr) return;
    clearError();
    try {
      await register(email.trim().toLowerCase(), username.trim(), password);
      router.replace('/(app)/(tabs)' as any);
    } catch { /* error shown via store */ }
  };

  const handleGoogleAuth = async (accessToken: string) => {
    clearError();
    try {
      await googleLogin(accessToken);
      router.replace('/(app)/(tabs)' as any);
    } catch { /* error shown via store */ }
  };

  const handleAppleAuth = async (identityToken: string, fullName: any) => {
    clearError();
    try {
      await appleLogin(identityToken, fullName);
      router.replace('/(app)/(tabs)' as any);
    } catch { /* error shown via store */ }
  };

  return (
    <LinearGradient colors={['#0A0A0F', '#0D0A1A']} style={styles.gradient}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[
            styles.container,
            { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing['2xl'] },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.primary} />
            <Text style={styles.backText}>Sign In</Text>
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join Socialess and take control of your screen time</Text>
          </View>

          {/* Server error banner */}
          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{error}</Text>
              <TouchableOpacity onPress={clearError} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.errorBannerClose}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Form */}
          <View style={styles.form}>
            <FormField
              label="Email"
              value={email}
              onChangeText={setEmail}
              error={emailError}
              touched={touched.email}
              placeholder="your@email.com"
              keyboardType="email-address"
              autoComplete="email"
              returnKeyType="next"
              onBlur={() => touch('email')}
              onSubmitEditing={() => usernameRef.current?.focus()}
            />

            <FormField
              label="Username"
              value={username}
              onChangeText={setUsername}
              error={usernameError}
              touched={touched.username}
              placeholder="your_username"
              autoComplete="username"
              returnKeyType="next"
              hint="3–20 characters, letters, numbers, and underscores"
              onBlur={() => touch('username')}
              onSubmitEditing={() => passwordRef.current?.focus()}
              inputRef={usernameRef}
            />

            <PasswordInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              error={passwordError}
              touched={touched.password}
              placeholder="••••••••"
              autoComplete="new-password"
              returnKeyType="next"
              showStrength
              onBlur={() => touch('password')}
              onSubmitEditing={() => confirmRef.current?.focus()}
              inputRef={passwordRef}
            />

            <PasswordInput
              label="Confirm Password"
              value={confirm}
              onChangeText={setConfirm}
              error={confirmError}
              touched={touched.confirm}
              placeholder="••••••••"
              autoComplete="new-password"
              returnKeyType="done"
              onBlur={() => touch('confirm')}
              onSubmitEditing={handleRegister}
              inputRef={confirmRef}
            />

            <Button
              label="Create Account"
              onPress={handleRegister}
              loading={isLoading}
              fullWidth
              size="lg"
              style={styles.submitBtn}
            />

            <Divider />

            <SocialAuthButtons
              onGoogleAuth={handleGoogleAuth}
              onAppleAuth={handleAppleAuth}
              disabled={isLoading}
            />

            <TouchableOpacity onPress={() => router.back()} style={styles.switchLink}>
              <Text style={styles.switchText}>
                Already have an account?{' '}
                <Text style={styles.switchHighlight}>Sign In</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

function Divider() {
  return (
    <View style={dividerStyles.row}>
      <View style={dividerStyles.line} />
      <Text style={dividerStyles.label}>or continue with</Text>
      <View style={dividerStyles.line} />
    </View>
  );
}

const dividerStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  line: { flex: 1, height: 1, backgroundColor: Colors.border },
  label: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: FontWeight.medium },
});

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  flex: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: Spacing.xl },

  backBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.xl },
  backText: { fontSize: FontSize.base, color: Colors.primary, fontWeight: FontWeight.medium },

  header: { marginBottom: Spacing['2xl'] },
  title: { fontSize: FontSize['3xl'], fontWeight: FontWeight.heavy, color: Colors.text, marginBottom: Spacing.xs },
  subtitle: { fontSize: FontSize.base, color: Colors.textMuted, lineHeight: 22 },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.danger + '1A',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.danger + '44',
    padding: Spacing.base,
    marginBottom: Spacing.base,
    gap: Spacing.sm,
  },
  errorBannerText: { flex: 1, color: Colors.danger, fontSize: FontSize.sm, lineHeight: 18 },
  errorBannerClose: { color: Colors.danger, fontSize: FontSize.base },

  form: { gap: Spacing.base },
  submitBtn: { marginTop: Spacing.xs },
  switchLink: { alignItems: 'center', paddingVertical: Spacing.sm },
  switchText: { fontSize: FontSize.sm, color: Colors.textMuted },
  switchHighlight: { color: Colors.primary, fontWeight: FontWeight.semibold },
});
