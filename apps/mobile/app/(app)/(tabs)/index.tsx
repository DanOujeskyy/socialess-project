import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  RefreshControl,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../../src/store/auth.store';
import { useTimeStore } from '../../../src/store/time.store';
import { useGameStore } from '../../../src/store/game.store';
import { usePedometer } from '../../../src/hooks/usePedometer';
import { TimeDisplay } from '../../../src/components/home/TimeDisplay';
import { ActivityButtons } from '../../../src/components/home/ActivityButton';
import { DailyStatsPanel } from '../../../src/components/home/DailyStatsPanel';
import { SocialAppsTracker } from '../../../src/components/home/SocialAppsTracker';
import { EventCardItem } from '../../../src/components/cards/EventCardItem';
import { Card } from '../../../src/components/ui/Card';
import { Button } from '../../../src/components/ui/Button';
import { Modal } from '../../../src/components/ui/Modal';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../../src/theme';
import { gameService } from '../../../src/services/game.service';
import type { GameMode } from '../../../src/types';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { currentEventCard, mode, challenge, setMode, setChallenge } = useGameStore();
  const { streak } = useTimeStore();
  const [showModeModal, setShowModeModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  usePedometer();

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const state = await gameService.getMyPlayerState();
      const ts = useTimeStore.getState();
      ts.setCurrentTime(state.currentTime);
      ts.setMaxTime(state.maxTime);
      ts.setActiveEffects(state.activeEffects);
      ts.setStreak(state.streak);
      ts.setDailyStats(state.dailyStats);
    } catch {}
    setRefreshing(false);
  };

  const handleJoinChallenge = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      Alert.alert('Missing code', 'Enter the invite code from your friend.');
      return;
    }
    try {
      const challenge = await gameService.joinChallenge(code);
      setMode('multiplayer');
      setChallenge(challenge);
      setShowJoinModal(false);
      setJoinCode('');
      router.push('/(app)/lobby');
    } catch (e: any) {
      Alert.alert('Join failed', e?.response?.data?.message ?? 'Could not join challenge');
    }
  };

  const handleStartMode = async (selectedMode: GameMode) => {
    setShowModeModal(false);
    try {
      const newChallenge = await gameService.createChallenge(selectedMode, {});
      setMode(selectedMode);
      setChallenge(newChallenge);
      if (selectedMode === 'multiplayer' || selectedMode === 'custom') {
        router.push('/(app)/lobby');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'Could not create challenge');
    }
  };

  return (
    <LinearGradient colors={[Colors.background, '#0D0D1A']} style={styles.gradient}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + Spacing.base }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hey, {user?.username ?? 'Player'} 👋</Text>
            <Text style={styles.subGreeting}>
              {streak > 0 ? `🔥 ${streak} day streak!` : 'Start your streak today'}
            </Text>
          </View>
          <View style={styles.headerRight}>
            {mode && (
              <View style={styles.modeBadge}>
                <Text style={styles.modeBadgeText}>{mode.toUpperCase()}</Text>
              </View>
            )}
            <TouchableOpacity onPress={() => router.push('/(app)/settings')} style={styles.settingsBtn}>
              <Text style={styles.settingsIcon}>⚙️</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Time Display */}
        <Card style={styles.timeCard} elevated>
          <TimeDisplay />
          <SocialAppsTracker />
        </Card>

        {/* Activities */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Earn Time</Text>
          <ActivityButtons />
        </View>

        {/* Event Card */}
        {currentEventCard && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Today's Event</Text>
            <EventCardItem card={currentEventCard} />
          </View>
        )}

        {/* Daily Stats */}
        <View style={styles.section}>
          <DailyStatsPanel />
        </View>

        {/* Game Mode Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Game Mode</Text>
          {!mode ? (
            <View style={styles.modeActions}>
              <Button
                label="Start Game"
                onPress={() => setShowModeModal(true)}
                variant="primary"
                style={styles.modeBtn}
              />
              <Button
                label="Join Challenge"
                onPress={() => setShowJoinModal(true)}
                variant="outline"
                style={styles.modeBtn}
              />
            </View>
          ) : (
            <Card>
              <Text style={styles.activeModeText}>
                {mode === 'singleplayer' && '🎯 Singleplayer — Survive on your own!'}
                {mode === 'multiplayer' && '⚔️ Multiplayer — Battle your friends!'}
                {mode === 'custom' && '🔧 Custom mode active'}
              </Text>
              {challenge && (
                <Text style={styles.challengeCode}>Code: {challenge.code}</Text>
              )}
              <Button
                label="Leave Mode"
                variant="ghost"
                size="sm"
                onPress={() => { setMode(null); setChallenge(null); }}
                style={{ marginTop: Spacing.sm }}
              />
            </Card>
          )}
        </View>

        <View style={{ height: Spacing['2xl'] }} />
      </ScrollView>

      {/* Mode Selection Modal */}
      <Modal visible={showModeModal} onClose={() => setShowModeModal(false)} title="Choose Mode">
        <View style={styles.modalContent}>
          {(
            [
              { mode: 'singleplayer' as GameMode, icon: '🎯', title: 'Singleplayer', desc: 'Build your streak solo. Event cards only.' },
              { mode: 'multiplayer' as GameMode, icon: '⚔️', title: 'Multiplayer', desc: 'Battle friends with game cards. Set penalties!' },
              { mode: 'custom' as GameMode, icon: '🔧', title: 'Custom', desc: 'Full control — your rules, your cards.' },
            ]
          ).map((item) => (
            <TouchableOpacity
              key={item.mode}
              style={styles.modeOption}
              onPress={() => handleStartMode(item.mode)}
            >
              <Text style={styles.modeOptionIcon}>{item.icon}</Text>
              <View style={styles.modeOptionInfo}>
                <Text style={styles.modeOptionTitle}>{item.title}</Text>
                <Text style={styles.modeOptionDesc}>{item.desc}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Modal>

      {/* Join Challenge Modal */}
      <Modal visible={showJoinModal} onClose={() => { setShowJoinModal(false); setJoinCode(''); }} title="Join Challenge">
        <View style={styles.modalContent}>
          <Text style={styles.joinDesc}>Enter the invite code from your friend.</Text>
          <TextInput
            style={styles.joinInput}
            value={joinCode}
            onChangeText={setJoinCode}
            placeholder="e.g. AB3F7K"
            placeholderTextColor={Colors.textDisabled}
            autoCapitalize="characters"
            maxLength={8}
          />
          <Button label="Join" onPress={handleJoinChallenge} fullWidth size="lg" />
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  scroll: { padding: Spacing.base, gap: Spacing.base },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.sm },
  greeting: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text },
  subGreeting: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  modeBadge: {
    backgroundColor: Colors.primary + '22',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.primary + '44',
  },
  modeBadgeText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.bold, letterSpacing: 0.8 },
  settingsBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  settingsIcon: { fontSize: 22 },
  timeCard: { gap: Spacing.md },
  section: { gap: Spacing.sm },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  modeActions: { flexDirection: 'row', gap: Spacing.sm },
  modeBtn: { flex: 1 },
  activeModeText: { fontSize: FontSize.base, color: Colors.text, fontWeight: FontWeight.medium },
  challengeCode: { fontSize: FontSize.sm, color: Colors.primary, marginTop: 4, fontVariant: ['tabular-nums'] },
  modalContent: { gap: Spacing.sm },
  joinDesc: { fontSize: FontSize.sm, color: Colors.textMuted },
  joinInput: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.heavy,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    textAlign: 'center',
    letterSpacing: 6,
  },
  modeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modeOptionIcon: { fontSize: 28 },
  modeOptionInfo: { flex: 1 },
  modeOptionTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.text },
  modeOptionDesc: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  chevron: { fontSize: FontSize.xl, color: Colors.textMuted },
});
