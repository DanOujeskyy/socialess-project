import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Share,
  Alert,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useGameStore } from '../../src/store/game.store';
import { useAuthStore } from '../../src/store/auth.store';
import { useSocketGame } from '../../src/hooks/useSocketGame';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../src/theme';
import { gameService } from '../../src/services/game.service';

export default function LobbyScreen() {
  const insets = useSafeAreaInsets();
  const { challenge, updateChallenge, leaveGame } = useGameStore();
  const userId = useAuthStore((s) => s.user?.id);
  const socketRef = useSocketGame(challenge?.id ?? null);
  const [penalties, setPenalties] = useState(challenge?.settings.penalties ?? '');
  const [starting, setStarting] = useState(false);

  const isHost = challenge?.hostId === userId;
  const players = challenge?.players ?? [];

  useEffect(() => {
    if (!challenge) { router.replace('/(app)/(tabs)/'); return; }
    if (challenge.status === 'active') router.replace('/(app)/(tabs)/');
  }, [challenge]);

  const handleShare = async () => {
    if (!challenge) return;
    await Share.share({
      message: `Join my Socialess challenge! Code: ${challenge.code}\nOpen the app and enter this code.`,
      title: 'Join my Socialess challenge',
    });
  };

  const handleStart = async () => {
    if (!challenge) return;
    setStarting(true);
    try {
      await gameService.startChallenge(challenge.id);
      updateChallenge({ status: 'active' });
      router.replace('/(app)/(tabs)/');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'Could not start game');
    }
    setStarting(false);
  };

  const handleLeave = () => {
    Alert.alert(
      'Leave Lobby',
      'Are you sure you want to leave this challenge?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            if (challenge) await gameService.leaveChallenge(challenge.id);
            leaveGame();
            router.replace('/(app)/(tabs)/');
          },
        },
      ],
    );
  };

  if (!challenge) return null;

  return (
    <LinearGradient colors={[Colors.background, '#0D0D1A']} style={styles.gradient}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + Spacing.base }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Lobby</Text>
          <Text style={styles.mode}>{challenge.mode.toUpperCase()}</Text>
        </View>

        <Card elevated style={styles.codeCard}>
          <Text style={styles.codeLabel}>Invite Code</Text>
          <Text style={styles.code}>{challenge.code}</Text>
          <Button label="Share Invite" variant="outline" onPress={handleShare} size="sm" />
        </Card>

        {/* Players */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Players ({players.length})</Text>
          <View style={styles.playerList}>
            {players.map((p) => (
              <View key={p.userId} style={styles.playerRow}>
                <View style={styles.playerAvatar}>
                  <Text style={styles.playerAvatarText}>{p.username.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={styles.playerName}>{p.username}</Text>
                {p.userId === challenge.hostId && (
                  <View style={styles.hostBadge}><Text style={styles.hostBadgeText}>Host</Text></View>
                )}
                {p.userId === userId && (
                  <View style={styles.meBadge}><Text style={styles.meBadgeText}>You</Text></View>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Penalties (host only) */}
        {challenge.mode === 'multiplayer' && isHost && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Penalties (optional)</Text>
            <TextInput
              style={styles.penaltiesInput}
              value={penalties}
              onChangeText={setPenalties}
              placeholder="e.g. Loser buys coffee ☕"
              placeholderTextColor={Colors.textDisabled}
              multiline
              numberOfLines={3}
            />
            <Text style={styles.penaltiesHint}>Set fun penalties for the loser. Visible to all players.</Text>
          </View>
        )}

        {/* Show penalties if set */}
        {challenge.settings.penalties && !isHost && (
          <Card>
            <Text style={styles.penaltiesLabel}>⚠️ Penalties</Text>
            <Text style={styles.penaltiesText}>{challenge.settings.penalties}</Text>
          </Card>
        )}

        <View style={styles.actions}>
          {isHost ? (
            <Button
              label={`Start Game (${players.length} player${players.length !== 1 ? 's' : ''})`}
              onPress={handleStart}
              loading={starting}
              fullWidth
              size="lg"
              disabled={players.length < 1}
            />
          ) : (
            <View style={styles.waitingRow}>
              <View style={styles.waitingDot} />
              <Text style={styles.waitingText}>Waiting for host to start…</Text>
            </View>
          )}
          <Button label="Leave Lobby" variant="ghost" onPress={handleLeave} fullWidth />
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  scroll: { padding: Spacing.base, gap: Spacing.base },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: FontSize['2xl'], fontWeight: FontWeight.heavy, color: Colors.text },
  mode: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    backgroundColor: Colors.primary + '22',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  codeCard: { alignItems: 'center', gap: Spacing.sm },
  codeLabel: { fontSize: FontSize.sm, color: Colors.textMuted },
  code: {
    fontSize: FontSize['4xl'],
    fontWeight: FontWeight.heavy,
    color: Colors.text,
    letterSpacing: 6,
    fontVariant: ['tabular-nums'],
  },
  section: { gap: Spacing.sm },
  sectionLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  playerList: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  playerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary + '33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerAvatarText: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.primary },
  playerName: { flex: 1, fontSize: FontSize.base, color: Colors.text, fontWeight: FontWeight.medium },
  hostBadge: {
    backgroundColor: Colors.warning + '22',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  hostBadgeText: { fontSize: FontSize.xs, color: Colors.warning, fontWeight: FontWeight.semibold },
  meBadge: {
    backgroundColor: Colors.primary + '22',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  meBadgeText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold },
  penaltiesInput: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    fontSize: FontSize.base,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  penaltiesHint: { fontSize: FontSize.xs, color: Colors.textMuted },
  penaltiesLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.warning, marginBottom: 4 },
  penaltiesText: { fontSize: FontSize.base, color: Colors.text },
  actions: { gap: Spacing.sm, marginTop: Spacing.md },
  waitingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
  waitingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
  waitingText: { fontSize: FontSize.base, color: Colors.textSecondary },
});
