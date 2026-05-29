import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Image,
  TouchableOpacity, Alert, RefreshControl, TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../../src/store/auth.store';
import { useTimeStore } from '../../../src/store/time.store';
import { useGameStore } from '../../../src/store/game.store';
import { usePedometer } from '../../../src/hooks/usePedometer';
import { useSocketGame, emitToSocket } from '../../../src/hooks/useSocketGame';
import { TimeDisplay } from '../../../src/components/home/TimeDisplay';
import { ActivityButtons } from '../../../src/components/home/ActivityButton';
import { DailyStatsPanel } from '../../../src/components/home/DailyStatsPanel';
import { EventCardItem } from '../../../src/components/cards/EventCardItem';
import { Card } from '../../../src/components/ui/Card';
import { Button } from '../../../src/components/ui/Button';
import { Modal } from '../../../src/components/ui/Modal';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../../src/theme';
import { gameService } from '../../../src/services/game.service';
import { RANK_TIER_CONFIG } from '../../../src/constants';
import type { RankTier } from '../../../src/types';

// ── Dev-only time controls ─────────────────────────────────────────────────────

function DevTimePanel() {
  const { addTime, consumeTime, setCurrentTime } = useTimeStore();
  return (
    <View style={devStyles.panel}>
      <Text style={devStyles.label}>⚙️ DEV — Time</Text>
      <View style={devStyles.row}>
        {[
          { label: '−10m', action: () => consumeTime(600) },
          { label: '−1m',  action: () => consumeTime(60)  },
          { label: '0',    action: () => setCurrentTime(0), danger: true },
          { label: '+1m',  action: () => addTime(60)       },
          { label: '+10m', action: () => addTime(600)      },
          { label: '+1h',  action: () => addTime(3600)     },
        ].map(({ label, action, danger }) => (
          <TouchableOpacity
            key={label}
            style={[devStyles.btn, danger && devStyles.btnDanger]}
            onPress={action}
            activeOpacity={0.7}
          >
            <Text style={[devStyles.btnText, danger && devStyles.btnTextDanger]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const devStyles = StyleSheet.create({
  panel:       { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)', paddingTop: Spacing.sm, gap: Spacing.xs },
  label:       { fontSize: 10, color: '#475569', letterSpacing: 0.8, textTransform: 'uppercase', textAlign: 'center' },
  row:         { flexDirection: 'row', justifyContent: 'center', gap: Spacing.xs, flexWrap: 'wrap' },
  btn:         { paddingHorizontal: Spacing.sm, paddingVertical: 5, borderRadius: Radius.md, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  btnDanger:   { borderColor: Colors.danger + '66', backgroundColor: Colors.danger + '11' },
  btnText:     { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  btnTextDanger: { color: Colors.danger },
});

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const user   = useAuthStore((s) => s.user);
  const { currentEventCard, challenge, matchmakingStatus, setMode, setChallenge, leaveGame, setMatchmakingStatus } = useGameStore();
  const { streak } = useTimeStore();

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode,      setJoinCode]      = useState('');
  const [creating,      setCreating]      = useState(false);
  const [joining,       setJoining]       = useState(false);
  const [refreshing,    setRefreshing]    = useState(false);

  usePedometer();
  useSocketGame(challenge?.id ?? null);

  const rankTier   = (((user as any)?.rankTier as string | undefined)?.toLowerCase() ?? 'bronze') as RankTier;
  const rankPoints = (user as any)?.rankPoints ?? 0;
  const tierCfg    = RANK_TIER_CONFIG[rankTier] ?? RANK_TIER_CONFIG.bronze;

  const isInChallenge = challenge !== null;
  const initial = user?.username?.charAt(0)?.toUpperCase() ?? '?';

  // ── Refresh ─────────────────────────────────────────────────────────────────

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

  // ── Challenge actions ────────────────────────────────────────────────────────

  const handleCreateChallenge = async () => {
    setCreating(true);
    try {
      const newChallenge = await gameService.createChallenge('multiplayer', {});
      setMode('multiplayer');
      setChallenge(newChallenge);
      router.push('/(app)/lobby');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'Could not create challenge');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinChallenge = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) { Alert.alert('Missing Code', 'Enter the invite code.'); return; }
    setJoining(true);
    try {
      const joined = await gameService.joinChallenge(code);
      setMode('multiplayer');
      setChallenge(joined);
      setShowJoinModal(false);
      setJoinCode('');
      router.push('/(app)/lobby');
    } catch (e: any) {
      Alert.alert('Could not join', e?.response?.data?.message ?? 'Invalid or expired code');
    } finally {
      setJoining(false);
    }
  };

  const handleLeaveChallenge = () => {
    Alert.alert(
      'Leave Challenge',
      'Are you sure? Your progress will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: leaveGame },
      ],
    );
  };

  // ── Ranked matchmaking ───────────────────────────────────────────────────────

  const handleFindMatch = () => {
    setMatchmakingStatus('queued');
    emitToSocket('ranked:queue');
    router.push('/(app)/matchmaking' as any);
  };

  return (
    <LinearGradient colors={[Colors.background, '#0D0D1A']} style={styles.gradient}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + Spacing.base }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={() => router.push('/(app)/profile' as any)}
              activeOpacity={0.8}
            >
              {user?.avatar ? (
                <Image source={{ uri: user.avatar }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initial}</Text>
                </View>
              )}
            </TouchableOpacity>
            <View>
              <Text style={styles.greeting}>Hey, {user?.username ?? 'Player'} 👋</Text>
              <Text style={styles.subGreeting}>
                {streak > 0 ? `🔥 ${streak}-day streak` : 'Start your streak today'}
              </Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            {/* Rank badge — taps to leaderboard */}
            <TouchableOpacity
              style={[styles.rankBadge, { backgroundColor: tierCfg.bg, borderColor: tierCfg.color + '55' }]}
              onPress={() => router.push('/(app)/leaderboard' as any)}
              activeOpacity={0.8}
            >
              <Text style={styles.rankIcon}>{tierCfg.icon}</Text>
              <View>
                <Text style={[styles.rankTierText, { color: tierCfg.color }]}>{tierCfg.label}</Text>
                <Text style={styles.rankPtsText}>{rankPoints} pts</Text>
              </View>
            </TouchableOpacity>

            {isInChallenge && (
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>⚔️ LIVE</Text>
              </View>
            )}

            <TouchableOpacity onPress={() => router.push('/(app)/settings')} style={styles.settingsBtn}>
              <Text style={styles.settingsIcon}>⚙️</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Play Buttons (always at top, prominent) ── */}
        {!isInChallenge ? (
          <View style={styles.playSection}>
            {/* Ranked Match */}
            <TouchableOpacity
              style={[styles.playBtn, styles.rankedBtn]}
              activeOpacity={0.82}
              onPress={handleFindMatch}
              disabled={matchmakingStatus === 'queued'}
            >
              <View style={[styles.playBtnIcon, { backgroundColor: '#A855F7' + '22' }]}>
                <Text style={{ fontSize: 26 }}>⚔️</Text>
              </View>
              <View style={styles.playBtnContent}>
                <Text style={styles.playBtnTitle}>
                  {matchmakingStatus === 'queued' ? 'Finding Match…' : 'Ranked Match'}
                </Text>
                <Text style={styles.playBtnSub}>
                  {matchmakingStatus === 'queued'
                    ? 'Searching for an opponent'
                    : `${tierCfg.icon} ${tierCfg.label} · ${rankPoints} pts`}
                </Text>
              </View>
              <View style={styles.playBtnArrow}>
                <Text style={{ fontSize: 18, color: '#A855F7' }}>›</Text>
              </View>
            </TouchableOpacity>

            {/* Friend Challenge row */}
            <View style={styles.friendRow}>
              <TouchableOpacity
                style={[styles.playBtn, styles.createBtn, { flex: 1 }]}
                activeOpacity={0.82}
                onPress={handleCreateChallenge}
                disabled={creating}
              >
                <Text style={{ fontSize: 22 }}>➕</Text>
                <View style={styles.playBtnContent}>
                  <Text style={styles.playBtnTitle}>{creating ? 'Creating…' : 'Create'}</Text>
                  <Text style={styles.playBtnSub}>New lobby</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.playBtn, styles.joinBtn, { flex: 1 }]}
                activeOpacity={0.82}
                onPress={() => setShowJoinModal(true)}
              >
                <Text style={{ fontSize: 22 }}>🔗</Text>
                <View style={styles.playBtnContent}>
                  <Text style={styles.playBtnTitle}>Join</Text>
                  <Text style={styles.playBtnSub}>Enter code</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* Active challenge banner */
          <Card style={styles.activeChallengeCard}>
            <View style={styles.activeChallengeRow}>
              <Text style={{ fontSize: 28 }}>{challenge.mode === 'ranked' ? '⚔️' : '🎮'}</Text>
              <View style={styles.activeChallengeInfo}>
                <Text style={styles.activeChallengeTitle}>
                  {challenge.mode === 'ranked' ? 'Ranked Match' : 'Active Challenge'}
                </Text>
                <View style={styles.activeChallengeCodeRow}>
                  {challenge.mode === 'ranked' ? (
                    <View style={styles.rankedBadge}>
                      <Text style={styles.rankedBadgeText}>
                        {tierCfg.icon} {tierCfg.label}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.activeChallengeCode}>{challenge.code}</Text>
                  )}
                  <View style={styles.activePlayers}>
                    <Text style={styles.activePlayersText}>{challenge.players.length} players</Text>
                  </View>
                </View>
              </View>
              {challenge.mode !== 'ranked' && (
                <TouchableOpacity style={styles.lobbyBtn} onPress={() => router.push('/(app)/lobby')}>
                  <Text style={styles.lobbyBtnText}>Lobby</Text>
                </TouchableOpacity>
              )}
            </View>
            <Button
              label={challenge.mode === 'ranked' ? 'Leave Ranked Match' : 'Leave Challenge'}
              variant="ghost"
              size="sm"
              onPress={handleLeaveChallenge}
              style={{ marginTop: Spacing.sm }}
            />
          </Card>
        )}

        {/* ── Time Card ── */}
        <Card style={styles.timeCard} elevated>
          <TimeDisplay />
          {__DEV__ && <DevTimePanel />}
        </Card>

        {/* ── Earn Time ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Earn Time</Text>
          <ActivityButtons />
        </View>

        {/* ── Event Card ── */}
        {currentEventCard && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Today's Event</Text>
            <EventCardItem card={currentEventCard} />
          </View>
        )}

        {/* ── Daily Stats ── */}
        <View style={styles.section}>
          <DailyStatsPanel />
        </View>

        <View style={{ height: Spacing['2xl'] }} />
      </ScrollView>

      {/* ── Join Modal ── */}
      <Modal
        visible={showJoinModal}
        onClose={() => { setShowJoinModal(false); setJoinCode(''); }}
        title="Join Challenge"
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalDesc}>Enter the invite code from your friend.</Text>
          <TextInput
            style={styles.codeInput}
            value={joinCode}
            onChangeText={setJoinCode}
            placeholder="e.g. AB3F7K"
            placeholderTextColor={Colors.textDisabled}
            autoCapitalize="characters"
            maxLength={8}
            autoFocus
          />
          <Button
            label={joining ? 'Joining…' : 'Join Challenge'}
            onPress={handleJoinChallenge}
            fullWidth
            size="lg"
          />
        </View>
      </Modal>
    </LinearGradient>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  scroll:   { padding: Spacing.base, gap: Spacing.base },

  // Header
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },

  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primary + '30',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.primary + '55',
  },
  avatarImg: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1.5, borderColor: Colors.primary + '55',
  },
  avatarText:  { fontSize: FontSize.lg, fontWeight: FontWeight.heavy, color: Colors.primary },
  greeting:    { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.text },
  subGreeting: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },

  // Rank badge in header
  rankBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: Radius.lg, borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 5,
  },
  rankIcon:     { fontSize: 16 },
  rankTierText: { fontSize: FontSize.xs, fontWeight: FontWeight.heavy, lineHeight: 14 },
  rankPtsText:  { fontSize: 10, color: Colors.textMuted, lineHeight: 12 },

  liveBadge: {
    backgroundColor: Colors.danger + '1A', borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 3,
    borderWidth: 1, borderColor: Colors.danger + '44',
  },
  liveBadgeText: { fontSize: FontSize.xs, color: Colors.danger, fontWeight: FontWeight.heavy },
  settingsBtn:   { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  settingsIcon:  { fontSize: 20 },

  // Play section — ranked + friend buttons at top
  playSection: { gap: Spacing.sm },

  playBtn: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: Radius.xl, padding: Spacing.base,
    borderWidth: 1, gap: Spacing.md,
  },
  rankedBtn: { backgroundColor: '#A855F7' + '0E', borderColor: '#A855F7' + '44' },
  createBtn: { backgroundColor: Colors.primary + '0E', borderColor: Colors.primary + '33' },
  joinBtn:   { backgroundColor: Colors.surfaceElevated, borderColor: Colors.border },

  playBtnIcon:    { width: 48, height: 48, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  playBtnContent: { flex: 1, gap: 2 },
  playBtnTitle:   { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.text },
  playBtnSub:     { fontSize: FontSize.xs, color: Colors.textMuted },
  playBtnArrow:   { width: 24, alignItems: 'center' },

  friendRow: { flexDirection: 'row', gap: Spacing.sm },

  // Active challenge card
  activeChallengeCard:    { gap: 0 },
  activeChallengeRow:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  activeChallengeInfo:    { flex: 1, gap: 4 },
  activeChallengeTitle:   { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.text },
  activeChallengeCodeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  activeChallengeCode:    { fontSize: FontSize.lg, fontWeight: FontWeight.heavy, color: Colors.primary, letterSpacing: 2 },
  rankedBadge:            { backgroundColor: '#A855F722', borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderWidth: 1, borderColor: '#A855F755' },
  rankedBadgeText:        { fontSize: FontSize.sm, color: '#A855F7', fontWeight: FontWeight.semibold },
  activePlayers:          { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  activePlayersText:      { fontSize: FontSize.xs, color: Colors.textMuted },
  lobbyBtn:               { backgroundColor: Colors.primary + '22', borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderWidth: 1, borderColor: Colors.primary + '44' },
  lobbyBtnText:           { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold },

  // Time card
  timeCard: { gap: Spacing.md },

  // Sections
  section:      { gap: Spacing.sm },
  sectionTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.heavy, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.4 },

  // Join modal
  modalContent: { gap: Spacing.md },
  modalDesc:    { fontSize: FontSize.sm, color: Colors.textMuted },
  codeInput: {
    backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg,
    padding: Spacing.base, fontSize: FontSize['2xl'],
    fontWeight: FontWeight.heavy, color: Colors.text,
    borderWidth: 1, borderColor: Colors.border,
    textAlign: 'center', letterSpacing: 6,
  },
});
