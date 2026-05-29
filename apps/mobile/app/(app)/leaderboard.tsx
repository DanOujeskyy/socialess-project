import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../src/store/auth.store';
import { leaderboardService } from '../../src/services/leaderboard.service';
import { RANK_TIER_CONFIG, getTierProgress } from '../../src/constants';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../src/theme';
import type { LeaderboardEntry, RankTier } from '../../src/types';

// ── Helpers ─────────────────────────────────────────────────────────────────────

function safeTier(rankTier?: string | null) {
  const key = (rankTier ?? 'bronze').toLowerCase() as RankTier;
  return RANK_TIER_CONFIG[key] ?? RANK_TIER_CONFIG.bronze;
}

// ── My rank card ──────────────────────────────────────────────────────────────

interface MeEntry extends LeaderboardEntry {
  rankedWins:   number;
  rankedLosses: number;
}

function MyRankCard({ me }: { me: MeEntry | null }) {
  if (!me) return null;

  const tier     = safeTier(me.rankTier);
  const progress = getTierProgress(me.rankPoints, (me.rankTier?.toLowerCase() ?? 'bronze') as RankTier);
  const total    = (me.rankedWins ?? 0) + (me.rankedLosses ?? 0);
  const winRate  = total > 0 ? Math.round(((me.rankedWins ?? 0) / total) * 100) : 0;

  return (
    <View style={[styles.myCard, { borderColor: tier.color + '66', backgroundColor: tier.bg }]}>
      <View style={styles.myCardRow}>
        {/* Rank number — fixed minimum width to prevent wrapping */}
        <View style={styles.myRankWrap}>
          <Text style={styles.myRankNum} numberOfLines={1} adjustsFontSizeToFit>
            {'#' + String(me.rank ?? '–')}
          </Text>
        </View>

        <View style={styles.myCardInfo}>
          <View style={styles.myNameRow}>
            <Text style={styles.tierIcon}>{tier.icon}</Text>
            <Text style={[styles.tierLabel, { color: tier.color }]}>{tier.label}</Text>
          </View>
          <Text style={styles.myUsername} numberOfLines={1}>{me.username ?? ''}</Text>
        </View>

        <View style={styles.myPoints}>
          <Text style={[styles.myPointsNum, { color: tier.color }]}>
            {String(me.rankPoints ?? 0)}
          </Text>
          <Text style={styles.myPointsLabel}>pts</Text>
        </View>
      </View>

      {/* Tier progress bar */}
      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            { width: (progress * 100) + '%' as any, backgroundColor: tier.color },
          ]}
        />
      </View>

      {/* W/L row */}
      <View style={styles.statsRow}>
        <View style={styles.statChip}>
          <Text style={[styles.statChipNum, { color: Colors.success }]}>{me.rankedWins ?? 0}</Text>
          <Text style={styles.statChipLabel}>Wins</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statChip}>
          <Text style={[styles.statChipNum, { color: Colors.danger }]}>{me.rankedLosses ?? 0}</Text>
          <Text style={styles.statChipLabel}>Losses</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statChip}>
          <Text style={[styles.statChipNum, { color: tier.color }]}>{winRate}%</Text>
          <Text style={styles.statChipLabel}>Win rate</Text>
        </View>
        {tier.maxPoints != null && (
          <>
            <View style={styles.statDivider} />
            <View style={styles.statChip}>
              <Text style={[styles.statChipNum, { color: tier.color }]}>
                {Math.max(0, tier.maxPoints - (me.rankPoints ?? 0))}
              </Text>
              <Text style={styles.statChipLabel}>to next tier</Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

// ── Leaderboard row ───────────────────────────────────────────────────────────

function LeaderboardRow({ entry, isMe }: { entry: LeaderboardEntry; isMe: boolean }) {
  const tier     = safeTier(entry.rankTier);
  const isPodium = entry.rank <= 3;

  const rankLabel = entry.rank === 1 ? '🥇'
    : entry.rank === 2 ? '🥈'
    : entry.rank === 3 ? '🥉'
    : '#' + String(entry.rank);

  return (
    <View style={[
      styles.row,
      isMe     ? styles.rowMe     : null,
      isPodium ? styles.rowPodium : null,
    ]}>
      {/* Fixed-width rank column — wide enough for "# 100" */}
      <Text
        style={[
          styles.rowRank,
          isPodium ? { fontSize: FontSize.lg } : null,
        ]}
        numberOfLines={1}
      >
        {rankLabel}
      </Text>

      <Text style={styles.rowTierIcon}>{tier.icon}</Text>

      <Text
        style={[styles.rowName, isMe ? { color: Colors.primary, fontWeight: FontWeight.bold } : null]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {entry.username ?? ''}{isMe ? ' (You)' : ''}
      </Text>

      <View style={styles.rowPointsWrap}>
        <Text style={[styles.rowPoints, { color: tier.color }]}>
          {String(entry.rankPoints ?? 0)}
        </Text>
        <Text style={styles.rowPtsLabel}>pts</Text>
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.user?.id);

  const [globalList, setGlobal]  = useState<LeaderboardEntry[]>([]);
  const [myRank,     setMyRank]  = useState<MeEntry | null>(null);
  const [loading,    setLoading] = useState(true);
  const [refreshing, setRefresh] = useState(false);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefresh(true); else setLoading(true);
    try {
      const [g, me] = await Promise.all([
        leaderboardService.getGlobal(),
        leaderboardService.getMyRank(),
      ]);
      setGlobal(Array.isArray(g) ? g.slice(0, 100) : []);
      if (me?.me) setMyRank(me.me as MeEntry);
    } catch {
      // silently ignore network errors
    }
    if (isRefresh) setRefresh(false); else setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <LinearGradient colors={[Colors.background, '#0D0D1A']} style={styles.gradient}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + Spacing.base }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={Colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.backIcon}>{'←'}</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>🏆 Rankings</Text>
            <Text style={styles.subtitle}>Top 100 · All Time</Text>
          </View>
          <View style={styles.backBtn} />
        </View>

        <MyRankCard me={myRank} />

        {/* Content */}
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={Colors.primary} size="large" />
          </View>
        ) : globalList.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>{'🏆'}</Text>
            <Text style={styles.emptyText}>No ranked matches yet</Text>
            <Text style={styles.emptySubtext}>Play ranked games to appear here</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {globalList.map((entry) => (
              <LeaderboardRow
                key={entry.userId}
                entry={entry}
                isMe={!!(userId && entry.userId === userId)}
              />
            ))}
          </View>
        )}

        <View style={{ height: Spacing['2xl'] }} />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  scroll:   { padding: Spacing.base, gap: Spacing.base },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  backBtn:      { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backIcon:     { fontSize: 22, color: Colors.text, fontWeight: FontWeight.heavy },
  headerCenter: { flex: 1, alignItems: 'center', gap: 2 },
  title:        { fontSize: FontSize.xl, fontWeight: FontWeight.heavy, color: Colors.text },
  subtitle:     { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: FontWeight.semibold, letterSpacing: 0.5 },

  // My rank card
  myCard:     { borderRadius: Radius.xl, borderWidth: 1.5, padding: Spacing.base, gap: Spacing.sm },
  myCardRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },

  // Fixed-width rank wrap to prevent wrapping
  myRankWrap: { width: 52, alignItems: 'flex-start' },
  myRankNum:  { fontSize: FontSize.xl, fontWeight: FontWeight.heavy, color: Colors.textMuted },

  myCardInfo: { flex: 1, gap: 2 },
  myNameRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  tierIcon:   { fontSize: 16 },
  tierLabel:  { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  myUsername: { fontSize: FontSize.lg, fontWeight: FontWeight.heavy, color: Colors.text },
  myPoints:   { alignItems: 'flex-end', gap: 1 },
  myPointsNum:   { fontSize: FontSize['2xl'], fontWeight: FontWeight.heavy },
  myPointsLabel: { fontSize: FontSize.xs, color: Colors.textMuted },

  progressBar:  { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },

  // W/L stat chips
  statsRow:   { flexDirection: 'row', alignItems: 'center' },
  statChip:   { flex: 1, alignItems: 'center', gap: 1 },
  statChipNum: { fontSize: FontSize.sm, fontWeight: FontWeight.heavy },
  statChipLabel: { fontSize: 10, color: Colors.textMuted },
  statDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.08)' },

  // List
  list: { gap: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceElevated,
  },
  rowMe: {
    backgroundColor: Colors.primary + '11',
    borderWidth: 1,
    borderColor: Colors.primary + '33',
  },
  rowPodium: { paddingVertical: Spacing.md },

  // Rank column: enough room for "# 100" without wrapping
  rowRank: {
    width: 42,
    minWidth: 42,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  rowTierIcon: { fontSize: 16, width: 22, textAlign: 'center' },
  rowName:     { flex: 1, fontSize: FontSize.sm, color: Colors.text, fontWeight: FontWeight.medium },
  rowPointsWrap: { alignItems: 'flex-end', gap: 1 },
  rowPoints:     { fontSize: FontSize.sm, fontWeight: FontWeight.heavy },
  rowPtsLabel:   { fontSize: 10, color: Colors.textMuted },

  loadingBox: { paddingVertical: Spacing['4xl'], alignItems: 'center' },
  empty:      { alignItems: 'center', paddingVertical: Spacing['4xl'], gap: Spacing.sm },
  emptyIcon:    { fontSize: 48 },
  emptyText:    { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  emptySubtext: { fontSize: FontSize.sm, color: Colors.textMuted },
});
