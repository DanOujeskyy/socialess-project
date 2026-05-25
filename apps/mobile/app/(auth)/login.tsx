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
import { useAuthStore } from '../../src/store/auth.store';
import { Button } from '../../src/components/ui/Button';
import { FormField } from '../../src/components/ui/FormField';
import { PasswordInput } from '../../src/components/ui/PasswordInput';
import { SocialAuthButtons } from '../../src/components/auth/SocialAuthButtons';
import { validateEmail, validateLoginPassword } from '../../src/validation/auth';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../src/theme';

type Fields = { email: boolean; password: boolean };

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState<Fields>({ email: false, password: false });

  const passwordRef = useRef<TextInput>(null);

  const { login, googleLogin, appleLogin, isLoading, error, clearError } = useAuthStore();

  const emailError    = touched.email    ? validateEmail(email)            : null;
  const passwordError = touched.password ? validateLoginPassword(password) : null;

  const touch = (field: keyof Fields) => setTouched(t => ({ ...t, [field]: true }));

  const handleLogin = async () => {
    setTouched({ email: true, password: true });
    const eErr = validateEmail(email);
    const pErr = validateLoginPassword(password);
    if (eErr || pErr) return;
    clearError();
    try {
      await login(email.trim().toLowerCase(), password);
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
            { paddingTop: insets.top + Spacing['2xl'], paddingBottom: insets.bottom + Spacing['2xl'] },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logo}>📵</Text>
            <Text style={styles.appName}>Socialess</Text>
            <Text style={styles.tagline}>Break free. Earn your time.</Text>
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
              onSubmitEditing={() => passwordRef.current?.focus()}
            />

            <PasswordInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              error={passwordError}
              touched={touched.password}
              placeholder="••••••••"
              autoComplete="current-password"
              returnKeyType="done"
              onBlur={() => touch('password')}
              onSubmitEditing={handleLogin}
              inputRef={passwordRef}
            />

            <TouchableOpacity
              style={styles.forgotBtn}
              onPress={() => router.push('/(auth)/forgot-password' as any)}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            <Button
              label="Sign In"
              onPress={handleLogin}
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

            <TouchableOpacity
              onPress={() => router.push('/(auth)/register')}
              style={styles.switchLink}
            >
              <Text style={styles.switchText}>
                Don't have an account?{' '}
                <Text style={styles.switchHighlight}>Create one</Text>
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

  header: { alignItems: 'center', marginBottom: Spacing['4xl'] },
  logo: { fontSize: 56, marginBottom: Spacing.md },
  appName: {
    fontSize: FontSize['4xl'],
    fontWeight: FontWeight.heavy,
    color: Colors.text,
    letterSpacing: -1,
  },
  tagline: { fontSize: FontSize.base, color: Colors.textMuted, marginTop: Spacing.xs },

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
  forgotBtn: { alignSelf: 'flex-end', marginTop: -Spacing.xs },
  forgotText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.medium },
  submitBtn: { marginTop: Spacing.xs },
  switchLink: { alignItems: 'center', paddingVertical: Spacing.sm },
  switchText: { fontSize: FontSize.sm, color: Colors.textMuted },
  switchHighlight: { color: Colors.primary, fontWeight: FontWeight.semibold },
});
