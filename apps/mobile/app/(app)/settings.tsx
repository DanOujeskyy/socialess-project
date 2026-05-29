import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Switch,
  TouchableOpacity, Alert, Platform, ActivityIndicator,
  TextInput, Image,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';
import { useAuthStore } from '../../src/store/auth.store';
import { useGameStore } from '../../src/store/game.store';
import { useSettingsStore } from '../../src/store/settings.store';
import { useTimeStore } from '../../src/store/time.store';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../src/theme';
import { RANK_TIER_CONFIG } from '../../src/constants';
import type { RankTier } from '../../src/types';
import {
  requestScreenTimeAuthorization,
  openScreenTimeAppPicker,
  getScreenTimeStatus,
} from '../../src/hooks/useScreenTimeBlocking';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtSecs(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m > 0 ? `${m}m` : ''}`.trim();
  return `${m}m`;
}

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({ label, icon }: { label: string; icon: string }) {
  return (
    <View style={sh.root}>
      <Text style={sh.icon}>{icon}</Text>
      <Text style={sh.label}>{label}</Text>
    </View>
  );
}
const sh = StyleSheet.create({
  root:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingBottom: Spacing.xs },
  icon:  { fontSize: 16 },
  label: { fontSize: FontSize.xs, fontWeight: FontWeight.heavy, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.2 },
});

// ── Card wrapper ───────────────────────────────────────────────────────────────

function SettingsCard({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View style={[sc.card, style]}>
      {children}
    </View>
  );
}
const sc = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
});

// ── Row toggle ────────────────────────────────────────────────────────────────

function ToggleRow({
  icon, label, sublabel, value, onToggle,
}: {
  icon: string; label: string; sublabel?: string;
  value: boolean; onToggle: (v: boolean) => void;
}) {
  return (
    <View style={tr.root}>
      <View style={tr.iconWrap}>
        <Text style={tr.icon}>{icon}</Text>
      </View>
      <View style={tr.text}>
        <Text style={tr.label}>{label}</Text>
        {sublabel ? <Text style={tr.sub}>{sublabel}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: Colors.border, true: Colors.primary + '77' }}
        thumbColor={value ? Colors.primary : Colors.textMuted}
      />
    </View>
  );
}
const tr = StyleSheet.create({
  root:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  iconWrap:{ width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  icon:    { fontSize: 18 },
  text:    { flex: 1, gap: 1 },
  label:   { fontSize: FontSize.base, color: Colors.text, fontWeight: FontWeight.semibold },
  sub:     { fontSize: FontSize.xs, color: Colors.textMuted },
});

// ── Tappable row ──────────────────────────────────────────────────────────────

function TapRow({
  icon, label, sublabel, value, onPress, accent,
}: {
  icon: string; label: string; sublabel?: string;
  value?: string; onPress?: () => void; accent?: boolean;
}) {
  return (
    <TouchableOpacity
      style={tap.root}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      <View style={tap.iconWrap}>
        <Text style={tap.icon}>{icon}</Text>
      </View>
      <View style={tap.text}>
        <Text style={[tap.label, accent && { color: Colors.primary }]}>{label}</Text>
        {sublabel ? <Text style={tap.sub}>{sublabel}</Text> : null}
      </View>
      {value ? <Text style={tap.value}>{value}</Text> : null}
      {onPress && <Text style={tap.arrow}>›</Text>}
    </TouchableOpacity>
  );
}
const tap = StyleSheet.create({
  root:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  iconWrap:{ width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  icon:    { fontSize: 18 },
  text:    { flex: 1, gap: 1 },
  label:   { fontSize: FontSize.base, color: Colors.text, fontWeight: FontWeight.semibold },
  sub:     { fontSize: FontSize.xs, color: Colors.textMuted },
  value:   { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: FontWeight.semibold },
  arrow:   { fontSize: 22, color: Colors.textMuted, fontWeight: FontWeight.bold },
});

// ── Goal input row ─────────────────────────────────────────────────────────────

function GoalNumberRow({
  icon, label, sublabel, value, min, max, step, onValue, suffix,
}: {
  icon: string; label: string; sublabel?: string;
  value: number; min: number; max: number; step?: number;
  onValue: (v: number) => void; suffix?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(String(value));

  const commit = () => {
    const n = parseInt(draft, 10);
    if (!isNaN(n)) onValue(Math.max(min, Math.min(max, n)));
    else setDraft(String(value));
    setEditing(false);
  };

  return (
    <View style={gn.root}>
      <View style={gn.iconWrap}>
        <Text style={gn.icon}>{icon}</Text>
      </View>
      <View style={gn.text}>
        <Text style={gn.label}>{label}</Text>
        {sublabel ? <Text style={gn.sub}>{sublabel}</Text> : null}
      </View>
      <View style={gn.inputWrap}>
        {editing ? (
          <TextInput
            style={gn.input}
            value={draft}
            onChangeText={setDraft}
            onBlur={commit}
            onSubmitEditing={commit}
            keyboardType="number-pad"
            autoFocus
            returnKeyType="done"
          />
        ) : (
          <TouchableOpacity onPress={() => { setDraft(String(value)); setEditing(true); }} activeOpacity={0.7}>
            <Text style={gn.inputValue}>{value}{suffix ?? ''}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
const gn = StyleSheet.create({
  root:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  iconWrap:  { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  icon:      { fontSize: 18 },
  text:      { flex: 1, gap: 1 },
  label:     { fontSize: FontSize.base, color: Colors.text, fontWeight: FontWeight.semibold },
  sub:       { fontSize: FontSize.xs, color: Colors.textMuted },
  inputWrap: { minWidth: 64, alignItems: 'flex-end' },
  input: {
    color: Colors.primary, fontSize: FontSize.base, fontWeight: FontWeight.heavy,
    borderBottomWidth: 1, borderBottomColor: Colors.primary,
    textAlign: 'right', minWidth: 64, paddingVertical: 2,
  },
  inputValue:{ color: Colors.primary, fontSize: FontSize.base, fontWeight: FontWeight.heavy },
});

// ── Divider ────────────────────────────────────────────────────────────────────

function Divider() {
  return <View style={{ height: 1, backgroundColor: Colors.border }} />;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuthStore();
  const { challenge, leaveGame } = useGameStore();
  const {
    notificationsEnabled, challengeNotifications, dailyRewardNotifications,
    setNotificationsEnabled, setChallengeNotifications, setDailyRewardNotifications,
    goals, setGoal, resetGoals,
  } = useSettingsStore();
  const { stopSocialUsage } = useTimeStore();

  const rankTier  = ((user as any)?.rankTier ?? 'bronze').toLowerCase() as RankTier;
  const tierCfg   = RANK_TIER_CONFIG[rankTier] ?? RANK_TIER_CONFIG.bronze;
  const rankPoints = (user as any)?.rankPoints ?? 0;

  // ── Screen Time state ─────────────────────────────────────────────────────
  const [stStatus, setStStatus] = useState<{
    authStatus: string; isBlocked: boolean; hasSelection: boolean;
  } | null>(null);
  const [stLoading, setStLoading] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    try { setStStatus(getScreenTimeStatus()); } catch {}
  }, []);

  const handleRequestAuth = useCallback(async () => {
    setStLoading(true);
    try {
      const ok = await requestScreenTimeAuthorization();
      if (ok) setStStatus(getScreenTimeStatus());
      else Alert.alert('Permission Denied', 'Open Settings → Screen Time and allow access for Socialess.');
    } finally { setStLoading(false); }
  }, []);

  const handleAppPicker = useCallback(async () => {
    setStLoading(true);
    try {
      const done = await openScreenTimeAppPicker();
      if (done) {
        setStStatus(getScreenTimeStatus());
        Alert.alert('Done', 'App selection saved.');
      }
    } finally { setStLoading(false); }
  }, []);

  // ── Time goal slider (seconds) ─────────────────────────────────────────────
  // Range: 5 min … 4 h, snapped to 5-minute increments
  const timeLimitMins = Math.round(goals.dailyTimeLimitSeconds / 60);

  // ── Stop tracking ─────────────────────────────────────────────────────────
  const handleStopTracking = useCallback(() => {
    Alert.alert('Stop Tracking?',
      'This will:\n• Reset your streak to 0\n• Remove you from the active challenge\n• Notify other players\n\nThis cannot be undone for today.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Stop Tracking', style: 'destructive', onPress: () => {
          stopSocialUsage();
          if (challenge) leaveGame();
        }},
      ],
    );
  }, [stopSocialUsage, challenge, leaveGame]);

  // ── Logout ────────────────────────────────────────────────────────────────
  const handleLogout = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        }},
      ],
    );
  }, [logout]);

  return (
    <LinearGradient colors={[Colors.background, '#0D0D1A']} style={s.gradient}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + Spacing.base }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Header ─────────────────────────────────────────────────── */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={16}>
            <Text style={s.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={s.title}>Settings</Text>
        </View>

        {/* ── Profile card ───────────────────────────────────────────── */}
        <TouchableOpacity
          style={s.profileCard}
          onPress={() => router.push('/(app)/profile' as any)}
          activeOpacity={0.8}
        >
          <View style={[s.avatarWrap, { borderColor: tierCfg.color + '66' }]}>
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={s.avatarImg} />
            ) : (
              <Text style={[s.avatarInitial, { color: tierCfg.color }]}>
                {user?.username?.charAt(0)?.toUpperCase() ?? '?'}
              </Text>
            )}
            <View style={[s.tierBadge, { backgroundColor: tierCfg.bg, borderColor: tierCfg.color + '55' }]}>
              <Text style={s.tierBadgeText}>{tierCfg.icon}</Text>
            </View>
          </View>
          <View style={s.profileInfo}>
            <Text style={s.profileName}>{user?.username}</Text>
            <Text style={s.profileEmail}>{user?.email}</Text>
            <View style={s.profileRankRow}>
              <Text style={[s.profileTier, { color: tierCfg.color }]}>{tierCfg.label}</Text>
              <Text style={s.profilePts}>{rankPoints} pts</Text>
            </View>
          </View>
          <View style={s.profileEditChip}>
            <Text style={s.profileEditText}>Edit</Text>
          </View>
        </TouchableOpacity>

        {/* ── Goals ──────────────────────────────────────────────────── */}
        <View style={s.section}>
          <SectionHeader icon="🎯" label="Daily Goals" />
          <SettingsCard>
            {/* Social media time limit — slider */}
            <View style={s.goalSliderRow}>
              <View style={tr.iconWrap}>
                <Text style={{ fontSize: 18 }}>📱</Text>
              </View>
              <View style={s.goalSliderText}>
                <Text style={tr.label}>Screen Time Limit</Text>
                <Text style={tr.sub}>How long you allow yourself per day</Text>
              </View>
              <Text style={s.goalSliderValue}>{fmtSecs(goals.dailyTimeLimitSeconds)}</Text>
            </View>
            <Slider
              style={s.slider}
              minimumValue={5 * 60}
              maximumValue={4 * 60 * 60}
              step={5 * 60}
              value={goals.dailyTimeLimitSeconds}
              onValueChange={(v) => setGoal('dailyTimeLimitSeconds', v)}
              minimumTrackTintColor={Colors.primary}
              maximumTrackTintColor={Colors.border}
              thumbTintColor={Colors.primary}
            />
            <View style={s.sliderLabels}>
              <Text style={s.sliderLabel}>5m</Text>
              <Text style={s.sliderLabel}>4h</Text>
            </View>

            <Divider />

            <GoalNumberRow
              icon="🏋️" label="Daily Push-ups Goal"
              sublabel="Number of push-ups to earn max time"
              value={goals.clicksGoal} min={5} max={500}
              onValue={(v) => setGoal('clicksGoal', v)}
            />
            <Divider />
            <GoalNumberRow
              icon="🦵" label="Daily Squats Goal"
              sublabel="Number of squats to earn max time"
              value={goals.squatsGoal} min={5} max={300}
              onValue={(v) => setGoal('squatsGoal', v)}
            />
            <Divider />
            <GoalNumberRow
              icon="👟" label="Daily Steps Goal"
              sublabel="Steps target for full time bonus"
              value={goals.stepsGoal} min={1000} max={50000} step={500}
              onValue={(v) => setGoal('stepsGoal', v)}
            />

            <TouchableOpacity onPress={() => Alert.alert('Reset Goals', 'Reset all goals to defaults?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Reset', style: 'destructive', onPress: resetGoals },
            ])}>
              <Text style={s.resetLink}>Reset to defaults</Text>
            </TouchableOpacity>
          </SettingsCard>
        </View>

        {/* ── Notifications ──────────────────────────────────────────── */}
        <View style={s.section}>
          <SectionHeader icon="🔔" label="Notifications" />
          <SettingsCard>
            <ToggleRow
              icon="⏰"
              label="Time Warnings"
              sublabel="5 min before limit + final alert"
              value={notificationsEnabled}
              onToggle={setNotificationsEnabled}
            />
            <Divider />
            <ToggleRow
              icon="⚔️"
              label="Challenge Updates"
              sublabel="Player joined, eliminated, game ended"
              value={challengeNotifications}
              onToggle={setChallengeNotifications}
            />
            <Divider />
            <ToggleRow
              icon="🎁"
              label="Daily Rewards"
              sublabel="Reminder to claim your daily streak reward"
              value={dailyRewardNotifications}
              onToggle={setDailyRewardNotifications}
            />
          </SettingsCard>
        </View>

        {/* ── App Blocking (iOS only) ─────────────────────────────────── */}
        {Platform.OS === 'ios' && (
          <View style={s.section}>
            <SectionHeader icon="🔒" label="App Blocking" />
            <SettingsCard style={{ borderColor: '#6C5CE7' + '33' }}>
              <Text style={s.cardHeading}>Screen Time Blocking</Text>
              <Text style={s.cardSubheading}>
                When your time runs out, Socialess automatically blocks selected
                apps via iOS Screen Time. Cannot be bypassed without the Screen Time passcode.
              </Text>

              {stStatus && (
                <View style={s.badgeRow}>
                  <View style={[s.badge, stStatus.authStatus === 'approved' ? s.badgeOk : s.badgeWarn]}>
                    <Text style={s.badgeText}>{stStatus.authStatus === 'approved' ? '✓ Authorized' : '✗ Not Authorized'}</Text>
                  </View>
                  <View style={[s.badge, stStatus.hasSelection ? s.badgeOk : s.badgeWarn]}>
                    <Text style={s.badgeText}>{stStatus.hasSelection ? '✓ Apps Selected' : '✗ No Apps'}</Text>
                  </View>
                  {stStatus.isBlocked && (
                    <View style={[s.badge, s.badgeDanger]}>
                      <Text style={s.badgeText}>🔒 Blocking Active</Text>
                    </View>
                  )}
                </View>
              )}

              <TouchableOpacity
                style={[s.stBtn, stStatus?.authStatus === 'approved' && s.stBtnDone]}
                onPress={handleRequestAuth}
                disabled={stLoading || stStatus?.authStatus === 'approved'}
                activeOpacity={0.75}
              >
                {stLoading ? <ActivityIndicator size="small" color="#fff" /> : (
                  <Text style={s.stBtnText}>
                    {stStatus?.authStatus === 'approved' ? '1. Permission Granted ✓' : '1. Allow Screen Time'}
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  s.stBtn,
                  stStatus?.authStatus !== 'approved' && s.stBtnDisabled,
                  stStatus?.hasSelection && s.stBtnDone,
                ]}
                onPress={handleAppPicker}
                disabled={stLoading || stStatus?.authStatus !== 'approved'}
                activeOpacity={0.75}
              >
                {stLoading ? <ActivityIndicator size="small" color="#fff" /> : (
                  <Text style={s.stBtnText}>
                    {stStatus?.hasSelection ? '2. Change App Selection' : '2. Select Apps to Block'}
                  </Text>
                )}
              </TouchableOpacity>
              <Text style={s.stNote}>
                Requires iOS 16+ and the com.apple.developer.family-controls entitlement.
                Custom development build required.
              </Text>
            </SettingsCard>
          </View>
        )}

        {/* ── Account ────────────────────────────────────────────────── */}
        <View style={s.section}>
          <SectionHeader icon="👤" label="Account" />
          <SettingsCard>
            <TapRow
              icon="✏️" label="Edit Profile"
              sublabel="Change avatar, username"
              onPress={() => router.push('/(app)/profile' as any)}
              accent
            />
            <Divider />
            <TapRow
              icon="🔐" label="Privacy Policy"
              onPress={() => Alert.alert('Privacy Policy', 'Full policy at socialess.app/privacy')}
            />
            <Divider />
            <TapRow
              icon="📄" label="Terms of Service"
              onPress={() => Alert.alert('Terms of Service', 'Full terms at socialess.app/terms')}
            />
            <Divider />
            <TapRow
              icon="❓" label="Help & Support"
              onPress={() => Alert.alert('Support', 'Email us at support@socialess.app')}
            />
          </SettingsCard>
        </View>

        {/* ── Active challenge info ───────────────────────────────────── */}
        {challenge && (
          <View style={s.section}>
            <SectionHeader icon="⚔️" label="Active Challenge" />
            <SettingsCard style={{ borderColor: Colors.primary + '33', backgroundColor: Colors.primary + '08' }}>
              <View style={s.challengeRow}>
                <Text style={s.challengeMode}>
                  {challenge.mode === 'ranked' ? '⚔️ Ranked Match' : '🎮 Challenge'}
                </Text>
                <Text style={s.challengePlayers}>{challenge.players.length} players</Text>
              </View>
              {challenge.mode !== 'ranked' && (
                <Text style={s.challengeCode}>Code: {challenge.code}</Text>
              )}
            </SettingsCard>
          </View>
        )}

        {/* ── Danger zone ────────────────────────────────────────────── */}
        <View style={s.section}>
          <SectionHeader icon="⚠️" label="Danger Zone" />
          <View style={s.dangerCard}>
            <Text style={s.dangerHeading}>Stop Tracking</Text>
            <Text style={s.dangerDesc}>
              For technical issues only. Stopping tracking resets your streak and removes you from
              any active challenge. Other players will be notified. This cannot be undone for today.
            </Text>
            <View style={s.dangerList}>
              {['Streak resets to 0', 'Removed from challenge', 'Other players notified', 'Cannot be undone today'].map((item) => (
                <View key={item} style={s.dangerListRow}>
                  <Text style={s.dangerBullet}>✕</Text>
                  <Text style={s.dangerListText}>{item}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity style={s.dangerBtn} onPress={handleStopTracking} activeOpacity={0.85}>
              <Text style={s.dangerBtnText}>Stop Tracking</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Sign out ───────────────────────────────────────────────── */}
        <TouchableOpacity style={s.signOutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <Text style={s.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* ── Version ────────────────────────────────────────────────── */}
        <View style={s.versionRow}>
          <Text style={s.versionText}>Socialess v1.0.0</Text>
          <Text style={s.versionText}>·</Text>
          <Text style={s.versionText}>Made with ❤️</Text>
        </View>

        <View style={{ height: insets.bottom + Spacing['2xl'] }} />
      </ScrollView>
    </LinearGradient>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  gradient: { flex: 1 },
  scroll:   { paddingHorizontal: Spacing.base, gap: Spacing.base },

  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.xs },
  back:   { fontSize: FontSize.base, color: Colors.primary },
  title:  { fontSize: FontSize['2xl'], fontWeight: FontWeight.heavy, color: Colors.text },

  // Profile card
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.xl, padding: Spacing.base,
    borderWidth: 1, borderColor: Colors.border,
  },
  avatarWrap: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarImg:     { width: 60, height: 60, borderRadius: 30 },
  avatarInitial: { fontSize: FontSize.xl, fontWeight: FontWeight.heavy },
  tierBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  tierBadgeText: { fontSize: 12 },
  profileInfo:   { flex: 1, gap: 2 },
  profileName:   { fontSize: FontSize.base, fontWeight: FontWeight.heavy, color: Colors.text },
  profileEmail:  { fontSize: FontSize.xs, color: Colors.textMuted },
  profileRankRow:{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 2 },
  profileTier:   { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  profilePts:    { fontSize: FontSize.xs, color: Colors.textMuted },
  profileEditChip: {
    backgroundColor: Colors.primary + '1A',
    borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.primary + '44',
  },
  profileEditText: { fontSize: FontSize.xs, fontWeight: FontWeight.heavy, color: Colors.primary },

  section: { gap: Spacing.sm },

  cardHeading:    { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.text },
  cardSubheading: { fontSize: FontSize.sm, color: Colors.textMuted, lineHeight: 20 },

  // Goals
  goalSliderRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  goalSliderText: { flex: 1, gap: 1 },
  goalSliderValue:{ fontSize: FontSize.base, fontWeight: FontWeight.heavy, color: Colors.primary },
  slider: { width: '100%', height: 36, marginVertical: -4 },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  sliderLabel: { fontSize: FontSize.xs, color: Colors.textDisabled },
  resetLink: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', textDecorationLine: 'underline' },

  // Badges (Screen Time)
  badgeRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  badge:      { borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderWidth: 1 },
  badgeOk:    { backgroundColor: '#10B981' + '1A', borderColor: '#10B981' + '55' },
  badgeWarn:  { backgroundColor: Colors.warning + '1A', borderColor: Colors.warning + '55' },
  badgeDanger:{ backgroundColor: Colors.danger + '1A', borderColor: Colors.danger + '55' },
  badgeText:  { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.text },
  stBtn: {
    backgroundColor: '#6C5CE7', borderRadius: Radius.xl,
    paddingVertical: Spacing.md, alignItems: 'center',
  },
  stBtnDone:     { backgroundColor: '#10B981' },
  stBtnDisabled: { backgroundColor: Colors.border, opacity: 0.5 },
  stBtnText:     { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: '#FFF' },
  stNote:        { fontSize: FontSize.xs, color: Colors.textDisabled, lineHeight: 16 },

  // Active challenge
  challengeRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  challengeMode:   { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.primary },
  challengePlayers:{ fontSize: FontSize.sm, color: Colors.textMuted },
  challengeCode:   { fontSize: FontSize.sm, color: Colors.text, fontVariant: ['tabular-nums'], letterSpacing: 1 },

  // Danger zone
  dangerCard: {
    backgroundColor: Colors.danger + '0D', borderRadius: Radius.xl,
    padding: Spacing.base, borderWidth: 1, borderColor: Colors.danger + '33', gap: Spacing.md,
  },
  dangerHeading: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.danger },
  dangerDesc:    { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  dangerList:    { gap: Spacing.xs },
  dangerListRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  dangerBullet:  { fontSize: FontSize.xs, color: Colors.danger, marginTop: 2 },
  dangerListText:{ flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary },
  dangerBtn: {
    backgroundColor: Colors.danger, borderRadius: Radius.xl,
    paddingVertical: Spacing.md, alignItems: 'center',
  },
  dangerBtnText: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: '#FFF' },

  signOutBtn: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.xl, paddingVertical: Spacing.base,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.danger + '44',
  },
  signOutText: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.danger },

  versionRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm },
  versionText: { fontSize: FontSize.sm, color: Colors.textDisabled },
});
