import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Easing, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useGameStore } from '../../src/store/game.store';
import { useAuthStore } from '../../src/store/auth.store';
import { emitToSocket } from '../../src/hooks/useSocketGame';
import { RANK_TIER_CONFIG } from '../../src/constants';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../src/theme';
import type { RankTier } from '../../src/types';

const TOTAL_SLOTS = 10;

function TierDot({ rankTier }: { rankTier: string }) {
  const tier = RANK_TIER_CONFIG[(rankTier ?? 'bronze') as RankTier] ?? RANK_TIER_CONFIG.bronze;
  return (
    <View style={[styles.tierDot, { backgroundColor: tier.color + '33', borderColor: tier.color + '88' }]}>
      <Text style={styles.tierDotIcon}>{tier.icon}</Text>
    </View>
  );
}

function PlayerCard({
  player,
  isMe,
  index,
}: {
  player: { username: string; rankTier: string; rankPoints: number };
  isMe: boolean;
  index: number;
}) {
  const anim  = useRef(new Animated.Value(0)).current;
  const tier  = RANK_TIER_CONFIG[(player.rankTier ?? 'bronze') as RankTier] ?? RANK_TIER_CONFIG.bronze;

  useEffect(() => {
    Animated.timing(anim, {
      toValue:         1,
      duration:        350,
      delay:           index * 40,
      easing:          Easing.out(Easing.back(1.4)),
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.playerCard,
        isMe && styles.playerCardMe,
        { opacity: anim, transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }] },
      ]}
    >
      <TierDot rankTier={player.rankTier} />
      <View style={styles.playerInfo}>
        <Text style={[styles.playerName, isMe && { color: Colors.primary }]} numberOfLines={1}>
          {player.username}{isMe ? ' (You)' : ''}
        </Text>
        <Text style={[styles.playerTierLabel, { color: tier.color }]}>
          {tier.icon} {tier.label} · {player.rankPoints} pts
        </Text>
      </View>
      {isMe && <View style={styles.youBadge}><Text style={styles.youBadgeText}>YOU</Text></View>}
    </Animated.View>
  );
}

function EmptySlot({ index }: { index: number }) {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.9, duration: 900 + index * 80, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 900 + index * 80, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();
  }, []);

  return (
    <Animated.View style={[styles.emptySlot, { opacity: pulse }]}>
      <View style={styles.emptyDot} />
      <Text style={styles.emptyText}>Waiting for player…</Text>
    </Animated.View>
  );
}

export default function MatchmakingScreen() {
  const insets  = useSafeAreaInsets();
  const user    = useAuthStore((s) => s.user);
  const { matchmakingStatus, rankedLobby } = useGameStore();

  // NOTE: Do NOT call useSocketGame here. The home screen keeps a singleton
  // socket alive in the background and handles all ranked:lobby_update /
  // ranked:matched events, updating the shared Zustand store. The matchmaking
  // screen is a pure consumer of that store state.

  // When ranked:matched fires (via home screen socket → game store), dismiss
  // this modal so the tabs become visible with the active challenge.
  useEffect(() => {
    if (matchmakingStatus === 'matched') {
      router.back();
    }
  }, [matchmakingStatus]);

  const [elapsed, setElapsed] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.10, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();
  }, []);

  // When ranked:matched fires (via the home socket → game store), the socket
  // handler in useSocketGame already calls router.replace('/(app)/(tabs)').
  // We do NOT duplicate navigation here to avoid double-replace races.

  const { setMatchmakingStatus } = useGameStore();

  const handleCancel = () => {
    emitToSocket('ranked:cancel');
    setMatchmakingStatus('idle');
    router.back();
  };

  const rankTier   = ((user as any)?.rankTier as RankTier) ?? 'bronze';
  const tierCfg    = RANK_TIER_CONFIG[rankTier] ?? RANK_TIER_CONFIG.bronze;
  const rankPoints = (user as any)?.rankPoints ?? 0;

  const formatElapsed = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const lobbyPlayers  = rankedLobby.players;
  const lobbyCount    = rankedLobby.count;
  const lobbyStatus   = rankedLobby.status;
  const emptySlots    = Math.max(0, TOTAL_SLOTS - lobbyCount);
  const fillPct       = lobbyCount / TOTAL_SLOTS;

  const myUsername = user?.username ?? '';
  const statusMsg  = lobbyStatus === 'starting'
    ? '🚀 Game starting!'
    : elapsed < 10
    ? 'Looking for players near your rank…'
    : elapsed < 20
    ? 'Filling lobby with available players…'
    : 'Almost ready — filling last slots…';

  return (
    <LinearGradient colors={[Colors.background, '#0D0D1A']} style={styles.gradient}>
      {/* Fixed top bar (safe-area aware) */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topBarInner}>
          <Animated.View style={[styles.orbSmall, { borderColor: tierCfg.color, transform: [{ scale: pulseAnim }] }]}>
            <Text style={styles.orbEmoji}>{tierCfg.icon}</Text>
          </Animated.View>

          <View style={styles.topBarCenter}>
            <Text style={styles.matchTitle}>⚔️ Ranked Match</Text>
            <Text style={styles.elapsed}>{formatElapsed(elapsed)}</Text>
          </View>

          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={handleCancel}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.cancelText}>✕ Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 80, paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Players joined</Text>
            <Text style={styles.progressCount}>
              <Text style={{ color: Colors.primary, fontWeight: FontWeight.heavy }}>{lobbyCount}</Text>
              <Text style={styles.progressTotal}> / {TOTAL_SLOTS}</Text>
            </Text>
          </View>
          <View style={styles.progressBar}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: `${fillPct * 100}%` as any,
                  backgroundColor: lobbyStatus === 'starting' ? Colors.success : Colors.primary,
                },
              ]}
            />
          </View>
          <Text style={[styles.statusMsg, lobbyStatus === 'starting' && { color: Colors.success }]}>
            {statusMsg}
          </Text>
        </View>

        {/* Player list */}
        <View style={styles.playerList}>
          {lobbyPlayers.map((p, i) => (
            <PlayerCard
              key={`${p.username}-${i}`}
              player={p}
              isMe={p.username === myUsername}
              index={i}
            />
          ))}
          {Array.from({ length: emptySlots }).map((_, i) => (
            <EmptySlot key={`empty-${i}`} index={i} />
          ))}
        </View>

        {/* My rank card */}
        <View style={[styles.rankCard, { borderColor: tierCfg.color + '55', backgroundColor: tierCfg.bg }]}>
          <Text style={[styles.rankTierLabel, { color: tierCfg.color }]}>{tierCfg.icon} {tierCfg.label}</Text>
          <Text style={styles.rankUsername}>{user?.username}</Text>
          <Text style={[styles.rankPoints, { color: tierCfg.color }]}>{rankPoints} pts</Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    backgroundColor: Colors.background + 'DD',
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  topBarInner: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm, gap: Spacing.sm,
  },
  orbSmall: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(108,92,231,0.12)',
  },
  orbEmoji:    { fontSize: 20 },
  topBarCenter: { flex: 1 },
  matchTitle:  { fontSize: FontSize.sm, fontWeight: FontWeight.heavy, color: Colors.text },
  elapsed:     { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold, fontVariant: ['tabular-nums'] },

  cancelBtn:  { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
  cancelText: { fontSize: FontSize.base, color: Colors.textMuted, fontWeight: FontWeight.semibold },

  scroll: { padding: Spacing.base, gap: Spacing.lg },

  progressSection: { gap: Spacing.sm },
  progressHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel:   { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: FontWeight.semibold },
  progressCount:   { fontSize: FontSize.base },
  progressTotal:   { color: Colors.textMuted, fontWeight: FontWeight.semibold },
  progressBar: {
    height: 8, borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill:  { height: '100%', borderRadius: 4 },
  statusMsg:     { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },

  playerList: { gap: Spacing.xs },

  playerCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1, borderColor: Colors.border,
  },
  playerCardMe: {
    borderColor: Colors.primary + '55',
    backgroundColor: Colors.primary + '0A',
  },
  tierDot: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  tierDotIcon:  { fontSize: 16 },
  playerInfo:   { flex: 1, gap: 1 },
  playerName:   { fontSize: FontSize.sm, fontWeight: FontWeight.heavy, color: Colors.text },
  playerTierLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  youBadge:     { backgroundColor: Colors.primary + '22', borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  youBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.heavy, color: Colors.primary },

  emptySlot: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  emptyDot:  { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surfaceElevated },
  emptyText: { fontSize: FontSize.sm, color: Colors.textMuted },

  rankCard: {
    borderRadius: Radius.xl, borderWidth: 1.5,
    padding: Spacing.md, alignItems: 'center', gap: Spacing.xs,
  },
  rankTierLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  rankUsername:  { fontSize: FontSize.base, fontWeight: FontWeight.heavy, color: Colors.text },
  rankPoints:    { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
});
