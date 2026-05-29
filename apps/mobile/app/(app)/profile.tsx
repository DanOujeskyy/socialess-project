import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform,
  Animated, Easing,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useAuthStore } from '../../src/store/auth.store';
import { authService } from '../../src/services/auth.service';
import { RANK_TIER_CONFIG } from '../../src/constants';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../src/theme';
import type { RankTier } from '../../src/types';

const AVATAR_SIZE = 200; // pixels for resized avatar

// ── Avatar picker button ──────────────────────────────────────────────────────

function AvatarButton({
  uri,
  initials,
  onPress,
  uploading,
}: {
  uri: string | null;
  initials: string;
  onPress: () => void;
  uploading: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.93, duration: 80, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1,    duration: 120, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <Animated.View style={[styles.avatarWrap, { transform: [{ scale }] }]}>
      <TouchableOpacity onPress={handlePress} activeOpacity={1} disabled={uploading}>
        {uri ? (
          <Image source={{ uri }} style={styles.avatarImg} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
        )}

        {/* Camera overlay */}
        <View style={styles.cameraOverlay}>
          {uploading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.cameraIcon}>📷</Text>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Field ─────────────────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  editable,
  error,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText?: (v: string) => void;
  placeholder?: string;
  editable?: boolean;
  error?: string | null;
  maxLength?: number;
}) {
  const [focused, setFocused] = useState(false);
  const isEditable = editable !== false;

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[
        styles.fieldInput,
        focused && styles.fieldInputFocused,
        !!error && styles.fieldInputError,
        !isEditable && styles.fieldInputReadonly,
      ]}>
        <TextInput
          style={styles.fieldText}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder ?? ''}
          placeholderTextColor={Colors.textMuted}
          editable={isEditable}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={maxLength}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {maxLength && isEditable ? (
          <Text style={styles.charCount}>
            {value.length}/{maxLength}
          </Text>
        ) : null}
      </View>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const insets   = useSafeAreaInsets();
  const user     = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);

  const rankTier   = (((user as any)?.rankTier as string | undefined)?.toLowerCase() ?? 'bronze') as RankTier;
  const rankPoints = (user as any)?.rankPoints ?? 0;
  const tierCfg    = RANK_TIER_CONFIG[rankTier] ?? RANK_TIER_CONFIG.bronze;

  // Form state
  const [username,       setUsername]      = useState(user?.username ?? '');
  const [avatarUri,      setAvatarUri]     = useState<string | null>(user?.avatar ?? null);
  const [pendingAvatar,  setPendingAvatar] = useState<string | null>(null); // base64 data-URI pending upload
  const [usernameError,  setUsernameError] = useState<string | null>(null);
  const [saving,         setSaving]        = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const hasChanges = username !== (user?.username ?? '') || pendingAvatar !== null;

  // ── Avatar picker ────────────────────────────────────────────────────────────

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Allow access to your photo library to change your avatar.',
        [{ text: 'OK' }],
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    setUploadingAvatar(true);
    try {
      // Resize and compress to square avatar
      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: AVATAR_SIZE, height: AVATAR_SIZE } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );

      if (!manipulated.base64) throw new Error('Could not encode image');

      const dataUri = `data:image/jpeg;base64,${manipulated.base64}`;
      setPendingAvatar(dataUri);
      setAvatarUri(manipulated.uri); // show locally immediately
    } catch {
      Alert.alert('Error', 'Could not process the image. Please try again.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // ── Validation ────────────────────────────────────────────────────────────────

  const validateUsername = (v: string): string | null => {
    const trimmed = v.trim();
    if (trimmed.length < 3)  return 'Username must be at least 3 characters';
    if (trimmed.length > 20) return 'Username must be at most 20 characters';
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) return 'Only letters, numbers and underscores allowed';
    return null;
  };

  const handleUsernameChange = (v: string) => {
    setUsername(v);
    setUsernameError(validateUsername(v));
  };

  // ── Save ──────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    const usernameErr = validateUsername(username);
    if (usernameErr) { setUsernameError(usernameErr); return; }

    setSaving(true);
    try {
      const payload: { username?: string; avatar?: string } = {};

      if (username.trim() !== (user?.username ?? '')) {
        payload.username = username.trim();
      }
      if (pendingAvatar) {
        payload.avatar = pendingAvatar;
      }

      if (Object.keys(payload).length === 0) {
        router.back();
        return;
      }

      const updated = await authService.updateProfile(payload);
      updateUser(updated as any);
      setPendingAvatar(null);
      Alert.alert('Saved', 'Your profile has been updated.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Could not save changes. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const initials = (user?.username?.charAt(0) ?? '?').toUpperCase();

  return (
    <LinearGradient colors={[Colors.background, '#0D0D1A']} style={styles.gradient}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + Spacing.sm }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
              <Text style={styles.backIcon}>{'←'}</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Edit Profile</Text>
            <View style={styles.backBtn} />
          </View>

          {/* Avatar */}
          <View style={styles.avatarSection}>
            <AvatarButton
              uri={avatarUri}
              initials={initials}
              onPress={pickAvatar}
              uploading={uploadingAvatar}
            />
            <Text style={styles.avatarHint}>Tap to change photo</Text>
          </View>

          {/* Rank badge */}
          <View style={[styles.rankCard, { borderColor: tierCfg.color + '55', backgroundColor: tierCfg.bg }]}>
            <Text style={[styles.rankIcon, { fontSize: 28 }]}>{tierCfg.icon}</Text>
            <View style={styles.rankInfo}>
              <Text style={[styles.rankTierLabel, { color: tierCfg.color }]}>{tierCfg.label}</Text>
              <Text style={styles.rankPoints}>{rankPoints} ranked pts</Text>
            </View>
            <View style={styles.rankRecord}>
              <Text style={styles.rankRecordText}>
                {(user as any)?.rankedWins ?? 0}W{' '}
                {(user as any)?.rankedLosses ?? 0}L
              </Text>
            </View>
          </View>

          {/* Fields */}
          <View style={styles.fieldsSection}>
            <Field
              label="Username"
              value={username}
              onChangeText={handleUsernameChange}
              placeholder="Enter username"
              error={usernameError}
              maxLength={20}
            />
            <Field
              label="Email"
              value={user?.email ?? ''}
              editable={false}
            />
            <Field
              label="Member since"
              value={user?.createdAt
                ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                : '–'}
              editable={false}
            />
          </View>

          {/* Save button */}
          <TouchableOpacity
            style={[
              styles.saveBtn,
              (!hasChanges || !!usernameError || saving) && styles.saveBtnDisabled,
            ]}
            onPress={handleSave}
            disabled={!hasChanges || !!usernameError || saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Save Changes</Text>
            )}
          </TouchableOpacity>

          {/* Danger zone — logout */}
          <View style={styles.dangerZone}>
            <Text style={styles.dangerLabel}>Account</Text>
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={() => {
                Alert.alert(
                  'Sign Out',
                  'Are you sure you want to sign out?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Sign Out', style: 'destructive',
                      onPress: () => {
                        useAuthStore.getState().logout();
                        router.replace('/(auth)/login' as any);
                      },
                    },
                  ],
                );
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.logoutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: insets.bottom + Spacing['2xl'] }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  scroll:   { padding: Spacing.base, gap: Spacing.lg },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: Spacing.xs,
  },
  backBtn:  { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 22, color: Colors.text, fontWeight: FontWeight.heavy },
  title:    { fontSize: FontSize['2xl'], fontWeight: FontWeight.heavy, color: Colors.text },

  // Avatar
  avatarSection: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  avatarWrap:    { position: 'relative' },
  avatarImg: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 3, borderColor: Colors.primary + '66',
  },
  avatarPlaceholder: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: Colors.primary + '22',
    borderWidth: 3, borderColor: Colors.primary + '66',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitials: { fontSize: 36, fontWeight: FontWeight.heavy, color: Colors.primary },
  cameraOverlay: {
    position: 'absolute', bottom: 0, right: 0,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.background,
  },
  cameraIcon: { fontSize: 14 },
  avatarHint: { fontSize: FontSize.xs, color: Colors.textMuted },

  // Rank card
  rankCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    borderRadius: Radius.xl, borderWidth: 1.5,
    padding: Spacing.md,
  },
  rankIcon:      {},
  rankInfo:      { flex: 1, gap: 2 },
  rankTierLabel: { fontSize: FontSize.base, fontWeight: FontWeight.heavy },
  rankPoints:    { fontSize: FontSize.sm, color: Colors.textMuted },
  rankRecord:    { alignItems: 'flex-end' },
  rankRecordText: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: FontWeight.semibold },

  // Fields
  fieldsSection: { gap: Spacing.md },
  field:         { gap: Spacing.xs },
  fieldLabel:    { fontSize: FontSize.xs, fontWeight: FontWeight.heavy, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  fieldInput: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  fieldInputFocused:  { borderColor: Colors.primary + '88' },
  fieldInputError:    { borderColor: Colors.danger + '88' },
  fieldInputReadonly: { opacity: 0.55 },
  fieldText:          { flex: 1, fontSize: FontSize.base, color: Colors.text, fontWeight: FontWeight.medium },
  fieldError:         { fontSize: FontSize.xs, color: Colors.danger },
  charCount:          { fontSize: FontSize.xs, color: Colors.textMuted },

  // Save button
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    height: 52,
    alignItems: 'center', justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontSize: FontSize.base, fontWeight: FontWeight.heavy, color: '#fff' },

  // Danger zone
  dangerZone: { gap: Spacing.sm, paddingTop: Spacing.xl },
  dangerLabel: {
    fontSize: FontSize.xs, fontWeight: FontWeight.heavy,
    color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8,
  },
  logoutBtn: {
    backgroundColor: Colors.danger + '14',
    borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.danger + '44',
    height: 52, alignItems: 'center', justifyContent: 'center',
  },
  logoutText: { fontSize: FontSize.base, fontWeight: FontWeight.heavy, color: Colors.danger },
});
