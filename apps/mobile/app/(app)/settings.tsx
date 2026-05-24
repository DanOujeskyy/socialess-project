import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../src/store/auth.store';
import { useGameStore } from '../../src/store/game.store';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../src/theme';
import { SOCIAL_APPS_CONFIG } from '../../src/constants';
import type { SocialApp } from '../../src/types';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuthStore();
  const { challenge } = useGameStore();
  const [trackedApps, setTrackedApps] = useState<Record<SocialApp, boolean>>({
    instagram: true,
    youtube: true,
    snapchat: true,
    tiktok: true,
    facebook: true,
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure? Disabling the app counts as losing your streak and challenge.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ],
    );
  };

  const toggleApp = (app: SocialApp) => {
    setTrackedApps((prev) => ({ ...prev, [app]: !prev[app] }));
  };

  return (
    <LinearGradient colors={[Colors.background, '#0D0D1A']} style={styles.gradient}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + Spacing.base }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Settings</Text>
        </View>

        {/* Profile */}
        <Card style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.username?.charAt(0)?.toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.username}>{user?.username}</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>
        </Card>

        {/* Tracked Apps */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tracked Social Apps</Text>
          <Text style={styles.sectionDesc}>Toggle which apps count towards your daily limit.</Text>
          <Card>
            {(Object.entries(SOCIAL_APPS_CONFIG) as [SocialApp, { name: string; color: string }][]).map(
              ([app, cfg], i, arr) => (
                <View key={app} style={[styles.settingRow, i < arr.length - 1 && styles.settingBorder]}>
                  <View style={[styles.appDot, { backgroundColor: cfg.color }]} />
                  <Text style={styles.settingLabel}>{cfg.name}</Text>
                  <Switch
                    value={trackedApps[app]}
                    onValueChange={() => toggleApp(app)}
                    trackColor={{ false: Colors.border, true: Colors.primary + '77' }}
                    thumbColor={trackedApps[app] ? Colors.primary : Colors.textMuted}
                  />
                </View>
              ),
            )}
          </Card>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <Card>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Enable Notifications</Text>
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: Colors.border, true: Colors.primary + '77' }}
                thumbColor={notificationsEnabled ? Colors.primary : Colors.textMuted}
              />
            </View>
          </Card>
        </View>

        {/* Info */}
        <Card style={styles.infoCard}>
          <Text style={styles.infoTitle}>⚠️ Important</Text>
          <Text style={styles.infoText}>
            Disabling this app or signing out counts as losing your daily streak and any active challenge.
            The game is designed to keep you accountable!
          </Text>
        </Card>

        {/* Sign Out */}
        <Button
          label="Sign Out"
          variant="danger"
          onPress={handleLogout}
          fullWidth
          size="lg"
        />

        <View style={styles.version}>
          <Text style={styles.versionText}>Socialess v1.0.0</Text>
        </View>

        <View style={{ height: Spacing['2xl'] }} />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  scroll: { padding: Spacing.base, gap: Spacing.base },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm },
  backBtn: {},
  backText: { fontSize: FontSize.base, color: Colors.primary },
  title: { fontSize: FontSize['2xl'], fontWeight: FontWeight.heavy, color: Colors.text },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary + '33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.primary },
  username: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.text },
  email: { fontSize: FontSize.sm, color: Colors.textMuted },
  section: { gap: Spacing.sm },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  sectionDesc: { fontSize: FontSize.sm, color: Colors.textMuted },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  settingBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  appDot: { width: 10, height: 10, borderRadius: 5 },
  settingLabel: { flex: 1, fontSize: FontSize.base, color: Colors.text },
  infoCard: { backgroundColor: Colors.warning + '11', borderColor: Colors.warning + '33', borderWidth: 1 },
  infoTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.warning, marginBottom: Spacing.xs },
  infoText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  version: { alignItems: 'center', paddingVertical: Spacing.md },
  versionText: { fontSize: FontSize.sm, color: Colors.textDisabled },
});
