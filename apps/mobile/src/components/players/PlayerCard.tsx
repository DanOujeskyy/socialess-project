import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../theme';
import { ProgressBar } from '../ui/ProgressBar';
import type { PlayerState } from '../../types';

interface PlayerCardProps {
  player: PlayerState;
  isMe?: boolean;
  onSendCard?: (player: PlayerState) => void;
}

function formatTime(s: number): string {
  const m = Math.floor(Math.abs(s) / 60);
  const sec = Math.abs(s) % 60;
  const sign = s < 0 ? '-' : '';
  return `${sign}${m}m ${String(sec).padStart(2, '0')}s`;
}

export function PlayerCard({ player, isMe, onSendCard }: PlayerCardProps) {
  const progress = player.maxTime > 0 ? Math.max(0, player.currentTime / player.maxTime) : 0;

  return (
    <View style={[styles.container, isMe && styles.meContainer, player.isEliminated && styles.eliminated]}>
      <View style={styles.header}>
        <View style={styles.avatarWrap}>
          <Text style={styles.avatarText}>
            {player.username.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{player.username}</Text>
            {isMe && <View style={styles.meBadge}><Text style={styles.meBadgeText}>You</Text></View>}
            {player.isEliminated && <View style={styles.elimBadge}><Text style={styles.elimText}>Out</Text></View>}
          </View>
          <Text style={[styles.time, player.currentTime < 0 && { color: Colors.danger }]}>
            {formatTime(player.currentTime)}
          </Text>
        </View>
        {!isMe && !player.isEliminated && onSendCard && (
          <TouchableOpacity style={styles.cardBtn} onPress={() => onSendCard(player)}>
            <Text style={styles.cardBtnText}>🃏</Text>
          </TouchableOpacity>
        )}
      </View>

      <ProgressBar value={progress} style={styles.bar} />

      {player.activeEffects.length > 0 && (
        <View style={styles.effects}>
          {player.activeEffects.slice(0, 3).map((e) => (
            <View key={e.id} style={styles.effectChip}>
              <Text style={styles.effectText}>{e.cardType.replace(/_/g, ' ')}</Text>
            </View>
          ))}
          {player.activeEffects.length > 3 && (
            <Text style={styles.moreEffects}>+{player.activeEffects.length - 3}</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  meContainer: { borderColor: Colors.primary + '55', borderWidth: 1.5 },
  eliminated: { opacity: 0.45 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary + '33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.primary },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: 2 },
  name: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.text, flex: 1 },
  meBadge: {
    backgroundColor: Colors.primary + '22',
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  meBadgeText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold },
  elimBadge: {
    backgroundColor: Colors.danger + '22',
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  elimText: { fontSize: FontSize.xs, color: Colors.danger, fontWeight: FontWeight.semibold },
  time: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text, fontVariant: ['tabular-nums'] },
  cardBtn: {
    width: 40,
    height: 40,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardBtnText: { fontSize: 18 },
  bar: {},
  effects: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  effectChip: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  effectText: { fontSize: FontSize.xs, color: Colors.textMuted, textTransform: 'capitalize' },
  moreEffects: { fontSize: FontSize.xs, color: Colors.textMuted, alignSelf: 'center' },
});
