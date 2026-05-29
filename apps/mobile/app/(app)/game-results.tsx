import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useGameStore } from '../../src/store/game.store';
import { useAuthStore } from '../../src/store/auth.store';
import { RANK_TIER_CONFIG } from '../../src/constants';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../src/theme';
import type { GamePlayerResult, PenaltyRule, RankTier } from '../../src/types';

function formatTime(seconds: number): string {
  if (seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const PLACEMENT_COLORS = ['#F59E0B', '#9CA3AF', '#CD7F32'];
const PLACEMENT_EMOJIS = ['🥇', '🥈', '🥉'];

function ResultRow({
  player,
  isMe,
  isRanked,
  penalty,
}: {
  player: GamePlayerResult;
  isMe: boolean;
  isRanked: boolean;
  penalty?: string;
}) {
  const tierCfg  = RANK_TIER_CONFIG[(player.rankTier ?? 'bronze') as RankTier];
  const emoji    = PLACEMENT_EMOJIS[player.placement - 1] ?? `#${player.placement}`;
  const isDanger = isRanked && (player.pointsChange ?? 0) < 0;
  const isGood   = isRanked && (player.pointsChange ?? 0) > 0;

  return (
    <View style={[styles.resultRow, isMe && styles.resultRowMe, player.placement === 1 && styles.resultRowFirst]}>
      {/* Placement + info */}
      <Text style={[styles.placeEmoji, { color: PLACEMENT_COLORS[player.placement - 1] ?? Colors.textMuted }]}>
        {emoji}
      </Text>
      <View style={styles.resultInfo}>
        <Text style={[styles.resultName, isMe && { color: Colors.primary }]} numberOfLines={1}>
          {player.username}{isMe ? ' (You)' : ''}
        </Text>
        <Text style={styles.resultTime}>
          {tierCfg.icon} {formatTime(player.currentTime)} remaining
        </Text>
        {/* Penalty tag — only for non-winners */}
        {penalty ? (
          <View style={styles.penaltyTag}>
            <Text style={styles.penaltyIcon}>⚠️</Text>
            <Text style={styles.penaltyText}>{penalty}</Text>
          </View>
        ) : player.placement === 1 ? (
          <View style={styles.winnerTag}>
            <Text style={styles.winnerTagText}>🏆 No penalty</Text>
          </View>
        ) : null}
      </View>
      {isRanked && player.pointsChange !== null && (
        <View style={styles.pointsChange}>
          <Text style={[styles.pointsDelta, isDanger && styles.ptsDanger, isGood && styles.ptsGood]}>
            {player.pointsChange > 0 ? `+${player.pointsChange}` : player.pointsChange}
          </Text>
          <Text style={[styles.pointsTotal, { color: tierCfg.color }]}>{player.rankPoints} pts</Text>
        </View>
      )}
    </View>
  );
}

export default function GameResultsScreen() {
  const insets  = useSafeAreaInsets();
  const results = useGameStore((s) => s.gameResults);
  const userId  = useAuthStore((s) => s.user?.id);

  if (!results) {
    router.replace('/(app)/(tabs)');
    return null;
  }

  const isRanked   = results.mode === 'ranked';
  const me         = results.players.find((p) => p.userId === userId);
  const iWon       = me?.placement === 1;
  const penalties  = results.penalties ?? [];
  const hasPenalties = penalties.length > 0;

  // Build a lookup: placement -> penalty description
  const penaltyMap = new Map<number, string>(
    penalties.map((r: PenaltyRule) => [r.placement, r.description]),
  );

  const handleHome = () => {
    useGameStore.getState().setGameResults(null);
    router.replace('/(app)/(tabs)');
  };

  const handlePlayAgain = () => {
    useGameStore.getState().setGameResults(null);
    router.replace('/(app)/matchmaking' as any);
  };

  const sortedPlayers = results.players.slice().sort((a, b) => a.placement - b.placement);

  return (
    <LinearGradient colors={[Colors.background, '#0D0D1A']} style={styles.gradient}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Winner announcement */}
        <View style={styles.winnerBanner}>
          <Text style={styles.winnerEmoji}>{iWon ? '🏆' : '💀'}</Text>
          <Text style={styles.winnerTitle}>{iWon ? 'Victory!' : 'Game Over'}</Text>
          {sortedPlayers[0] && (
            <Text style={styles.winnerSub}>
              {sortedPlayers[0].username} wins with {formatTime(sortedPlayers[0].currentTime)} remaining
            </Text>
          )}
        </View>

        {/* Mode badge */}
        <View style={[styles.modeBadge, isRanked && styles.modeBadgeRanked]}>
          <Text style={[styles.modeText, isRanked && { color: '#A855F7' }]}>
            {isRanked ? '⚔️ RANKED' : '👥 MULTIPLAYER'}
          </Text>
        </View>

        {/* Penalty notice */}
        {hasPenalties && (
          <View style={styles.penaltyNotice}>
            <Text style={styles.penaltyNoticeTitle}>⚠️ Penalties apply</Text>
            <Text style={styles.penaltyNoticeBody}>
              Players must complete their assigned penalty before rejoining the game.
            </Text>
          </View>
        )}

        {/* Results */}
        <View style={styles.resultList}>
          {sortedPlayers.map((p) => (
            <ResultRow
              key={p.userId}
              player={p}
              isMe={p.userId === userId}
              isRanked={isRanked}
              penalty={penaltyMap.get(p.placement)}
            />
          ))}
        </View>

        {/* My penalty callout */}
        {me && penaltyMap.has(me.placement) && (
          <View style={styles.myPenaltyCard}>
            <Text style={styles.myPenaltyLabel}>Your penalty</Text>
            <Text style={styles.myPenaltyValue}>{penaltyMap.get(me.placement)}</Text>
            <Text style={styles.myPenaltyHint}>Complete this before resuming the app.</Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {isRanked && (
            <TouchableOpacity style={styles.playAgainBtn} onPress={handlePlayAgain}>
              <Text style={styles.playAgainText}>Find Another Match</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.homeBtn} onPress={handleHome}>
            <Text style={styles.homeText}>Return Home</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: Spacing['2xl'] }} />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  scroll:   { padding: Spacing.base, gap: Spacing.lg },

  winnerBanner: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  winnerEmoji:  { fontSize: 72 },
  winnerTitle:  { fontSize: FontSize['4xl'], fontWeight: FontWeight.heavy, color: Colors.text },
  winnerSub:    { fontSize: FontSize.base, color: Colors.textMuted, textAlign: 'center' },

  modeBadge: {
    alignSelf: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modeBadgeRanked: { borderColor: '#A855F7' + '44', backgroundColor: '#A855F7' + '11' },
  modeText: { fontSize: FontSize.xs, fontWeight: FontWeight.heavy, color: Colors.textMuted, letterSpacing: 1.2 },

  penaltyNotice: {
    backgroundColor: Colors.danger + '14',
    borderColor: Colors.danger + '44',
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    gap: 4,
  },
  penaltyNoticeTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.heavy, color: Colors.danger },
  penaltyNoticeBody:  { fontSize: FontSize.sm, color: Colors.textMuted },

  resultList: { gap: Spacing.sm },
  resultRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.md, borderRadius: Radius.xl,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1, borderColor: Colors.border,
  },
  resultRowMe:    { borderColor: Colors.primary + '44', backgroundColor: Colors.primary + '0A' },
  resultRowFirst: { borderColor: '#F59E0B' + '44', backgroundColor: '#F59E0B' + '0A' },

  placeEmoji: { fontSize: 28, width: 36, textAlign: 'center' },
  resultInfo: { flex: 1, gap: 3 },
  resultName: { fontSize: FontSize.base, fontWeight: FontWeight.heavy, color: Colors.text },
  resultTime: { fontSize: FontSize.sm, color: Colors.textMuted },

  penaltyTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  penaltyIcon: { fontSize: 11 },
  penaltyText: { fontSize: FontSize.xs, color: Colors.danger, fontWeight: FontWeight.semibold, flexShrink: 1 },

  winnerTag:     { marginTop: 2 },
  winnerTagText: { fontSize: FontSize.xs, color: Colors.success, fontWeight: FontWeight.semibold },

  pointsChange: { alignItems: 'flex-end', gap: 2 },
  pointsDelta:  { fontSize: FontSize.base, fontWeight: FontWeight.heavy, color: Colors.textMuted },
  ptsDanger:    { color: Colors.danger },
  ptsGood:      { color: Colors.success },
  pointsTotal:  { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },

  myPenaltyCard: {
    backgroundColor: Colors.danger + '14',
    borderColor: Colors.danger + '55',
    borderWidth: 1.5,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    gap: 4,
    alignItems: 'center',
  },
  myPenaltyLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.heavy, color: Colors.danger, textTransform: 'uppercase', letterSpacing: 1 },
  myPenaltyValue: { fontSize: FontSize['2xl'], fontWeight: FontWeight.heavy, color: Colors.text, textAlign: 'center' },
  myPenaltyHint:  { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center' },

  actions: { gap: Spacing.sm, marginTop: Spacing.md },
  playAgainBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.xl,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  playAgainText: { fontSize: FontSize.base, fontWeight: FontWeight.heavy, color: '#fff' },
  homeBtn: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.xl,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  homeText: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
});
