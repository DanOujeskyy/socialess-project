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
import { FormField } from '../../src/components/ui/FormField';
import { PasswordInput } from '../../src/components/ui/PasswordInput';
import { Button } from '../../src/components/ui/Button';
import { authService } from '../../src/services/auth.service';
import { validateEmail, validatePassword, validatePasswordConfirm } from '../../src/validation/auth';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../src/theme';

type Step = 'email' | 'code';

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const [step, setStep]         = useState<Step>('email');
  const [email, setEmail]       = useState('');
  const [code, setCode]         = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');

  const [emailTouched, setEmailTouched] = useState(false);
  const [codeTouched, setCodeTouched]   = useState(false);
  const [pwTouched, setPwTouched]       = useState(false);
  const [cfTouched, setCfTouched]       = useState(false);

  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState(false);

  const passwordRef = useRef<TextInput>(null);
  const confirmRef  = useRef<TextInput>(null);

  const emailError = emailTouched ? validateEmail(email) : null;
  const pwError    = pwTouched    ? validatePassword(password) : null;
  const cfError    = cfTouched    ? validatePasswordConfirm(password, confirm) : null;
  const codeError  = codeTouched && !code.trim() ? 'Enter the 6-digit code from your email' : null;

  const handleSendCode = async () => {
    setEmailTouched(true);
    if (validateEmail(email)) return;
    setLoading(true);
    setError(null);
    try {
      await authService.forgotPassword(email.trim().toLowerCase());
      setStep('code');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setCodeTouched(true);
    setPwTouched(true);
    setCfTouched(true);
    if (!code.trim() || validatePassword(password) || validatePasswordConfirm(password, confirm)) return;
    setLoading(true);
    setError(null);
    try {
      await authService.resetPassword(email.trim().toLowerCase(), code.trim(), password);
      setSuccess(true);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <LinearGradient colors={['#0A0A0F', '#0D0A1A']} style={styles.gradient}>
        <View style={[styles.successContainer, { paddingTop: insets.top + Spacing['4xl'] }]}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={72} color={Colors.success} />
          </View>
          <Text style={styles.successTitle}>Password Updated!</Text>
          <Text style={styles.successSubtitle}>
            Your password has been reset successfully. You can now sign in with your new password.
          </Text>
          <Button
            label="Back to Sign In"
            onPress={() => router.replace('/(auth)/login' as any)}
            fullWidth
            size="lg"
            style={styles.successBtn}
          />
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0A0A0F', '#0D0A1A']} style={styles.gradient}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView
          contentContainerStyle={[
            styles.container,
            { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing['2xl'] },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.primary} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          {/* Step indicator */}
          <View style={styles.steps}>
            <StepDot active={step === 'email'} done={step === 'code'} number={1} label="Email" />
            <View style={styles.stepLine} />
            <StepDot active={step === 'code'} done={false} number={2} label="New password" />
          </View>

          {step === 'email' ? (
            <View style={styles.form}>
              <View style={styles.header}>
                <Text style={styles.title}>Forgot password?</Text>
                <Text style={styles.subtitle}>
                  Enter your email and we'll send you a 6-digit code to reset your password.
                </Text>
              </View>

              {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

              <FormField
                label="Email address"
                value={email}
                onChangeText={setEmail}
                error={emailError}
                touched={emailTouched}
                placeholder="your@email.com"
                keyboardType="email-address"
                autoComplete="email"
                returnKeyType="done"
                onBlur={() => setEmailTouched(true)}
                onSubmitEditing={handleSendCode}
              />

              <Button
                label="Send Reset Code"
                onPress={handleSendCode}
                loading={loading}
                fullWidth
                size="lg"
                style={styles.btn}
              />
            </View>
          ) : (
            <View style={styles.form}>
              <View style={styles.header}>
                <Text style={styles.title}>Check your email</Text>
                <Text style={styles.subtitle}>
                  We sent a 6-digit code to{' '}
                  <Text style={styles.emailHighlight}>{email}</Text>.
                  Enter it below along with your new password.
                </Text>
              </View>

              {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

              <FormField
                label="6-digit code"
                value={code}
                onChangeText={setCode}
                error={codeError}
                touched={codeTouched}
                placeholder="123456"
                keyboardType="number-pad"
                returnKeyType="next"
                onBlur={() => setCodeTouched(true)}
                onSubmitEditing={() => passwordRef.current?.focus()}
                hint="Check your inbox (and spam folder)"
              />

              <PasswordInput
                label="New password"
                value={password}
                onChangeText={setPassword}
                error={pwError}
                touched={pwTouched}
                placeholder="••••••••"
                autoComplete="new-password"
                returnKeyType="next"
                showStrength
                onBlur={() => setPwTouched(true)}
                onSubmitEditing={() => confirmRef.current?.focus()}
                inputRef={passwordRef}
              />

              <PasswordInput
                label="Confirm new password"
                value={confirm}
                onChangeText={setConfirm}
                error={cfError}
                touched={cfTouched}
                placeholder="••••••••"
                autoComplete="new-password"
                returnKeyType="done"
                onBlur={() => setCfTouched(true)}
                onSubmitEditing={handleResetPassword}
                inputRef={confirmRef}
              />

              <Button
                label="Reset Password"
                onPress={handleResetPassword}
                loading={loading}
                fullWidth
                size="lg"
                style={styles.btn}
              />

              <TouchableOpacity onPress={() => { setStep('email'); setError(null); }} style={styles.resendLink}>
                <Text style={styles.resendText}>
                  Didn't get the code?{' '}
                  <Text style={styles.resendHighlight}>Send again</Text>
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

function StepDot({ active, done, number, label }: { active: boolean; done: boolean; number: number; label: string }) {
  return (
    <View style={stepStyles.wrapper}>
      <View style={[stepStyles.dot, active && stepStyles.dotActive, done && stepStyles.dotDone]}>
        {done
          ? <Ionicons name="checkmark" size={14} color={Colors.text} />
          : <Text style={[stepStyles.dotText, active && stepStyles.dotTextActive]}>{number}</Text>
        }
      </View>
      <Text style={[stepStyles.label, active && stepStyles.labelActive]}>{label}</Text>
    </View>
  );
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <View style={bannerStyles.container}>
      <Text style={bannerStyles.text}>{message}</Text>
      <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={bannerStyles.close}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const stepStyles = StyleSheet.create({
  wrapper: { alignItems: 'center', gap: 4 },
  dot: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  dotActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '22' },
  dotDone: { backgroundColor: Colors.success, borderColor: Colors.success },
  dotText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textMuted },
  dotTextActive: { color: Colors.primary },
  label: { fontSize: FontSize.xs, color: Colors.textMuted },
  labelActive: { color: Colors.primary, fontWeight: FontWeight.medium },
});

const bannerStyles = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.danger + '1A',
    borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.danger + '44',
    padding: Spacing.base, gap: Spacing.sm,
  },
  text: { flex: 1, color: Colors.danger, fontSize: FontSize.sm, lineHeight: 18 },
  close: { color: Colors.danger, fontSize: FontSize.base },
});

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  flex: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: Spacing.xl },

  backBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.xl },
  backText: { fontSize: FontSize.base, color: Colors.primary, fontWeight: FontWeight.medium },

  steps: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: Spacing['2xl'],
    paddingHorizontal: Spacing.xl,
  },
  stepLine: { flex: 1, height: 2, backgroundColor: Colors.border, marginHorizontal: Spacing.sm },

  form: { gap: Spacing.base },
  header: { marginBottom: Spacing.sm },
  title: { fontSize: FontSize['3xl'], fontWeight: FontWeight.heavy, color: Colors.text, marginBottom: Spacing.xs },
  subtitle: { fontSize: FontSize.base, color: Colors.textMuted, lineHeight: 22 },
  emailHighlight: { color: Colors.text, fontWeight: FontWeight.medium },
  btn: { marginTop: Spacing.xs },
  resendLink: { alignItems: 'center', paddingVertical: Spacing.sm },
  resendText: { fontSize: FontSize.sm, color: Colors.textMuted },
  resendHighlight: { color: Colors.primary, fontWeight: FontWeight.semibold },

  successContainer: { flex: 1, paddingHorizontal: Spacing.xl, alignItems: 'center', justifyContent: 'center', gap: Spacing.base },
  successIcon: { marginBottom: Spacing.lg },
  successTitle: { fontSize: FontSize['3xl'], fontWeight: FontWeight.heavy, color: Colors.text, textAlign: 'center' },
  successSubtitle: { fontSize: FontSize.base, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },
  successBtn: { marginTop: Spacing['2xl'], width: '100%' },
});
