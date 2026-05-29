import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Alert, TextInput,
  TouchableOpacity, Share, Linking,
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
import { STARTING_TIME_OPTIONS, STARTING_CARDS_OPTIONS, PLACEMENT_LABELS } from '../../src/constants';
import type { ChallengeSettings, PenaltyRule } from '../../src/types';

// ── Chip Selector ──────────────────────────────────────────────────────────────

function ChipSelector<T extends number | string>({
  options, value, onChange, disabled,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <View style={cs.row}>
      {options.map((o) => (
        <TouchableOpacity
          key={String(o.value)}
          style={[cs.chip, value === o.value && cs.chipActive]}
          onPress={() => !disabled && onChange(o.value)}
          activeOpacity={0.8}
          disabled={disabled}
        >
          <Text style={[cs.chipText, value === o.value && cs.chipTextActive]}>{o.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const cs = StyleSheet.create({
  row:          { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip:         { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.border },
  chipActive:   { backgroundColor: Colors.primary + '22', borderColor: Colors.primary },
  chipText:     { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: FontWeight.medium },
  chipTextActive: { color: Colors.primary, fontWeight: FontWeight.semibold },
});

// ── Penalty Editor ─────────────────────────────────────────────────────────────
// Shows a row for each losing placement (2nd, 3rd, 4th, 5th).
// Winner (1st place) never has a penalty.

function PenaltyEditor({
  penalties,
  onChange,
}: {
  penalties: PenaltyRule[];
  onChange: (rules: PenaltyRule[]) => void;
}) {
  const placements = [2, 3, 4, 5];

  const getDesc = (p: number) => penalties.find((r) => r.placement === p)?.description ?? '';

  const setDesc = (p: number, description: string) => {
    const next = penalties.filter((r) => r.placement !== p);
    if (description.trim()) next.push({ placement: p, description: description.trim() });
    onChange(next.sort((a, b) => a.placement - b.placement));
  };

  return (
    <View style={pe.container}>
      {/* Winner row — always no penalty */}
      <View style={pe.row}>
        <Text style={pe.placementLabel}>🏆 1st place</Text>
        <View style={pe.winnerBadge}>
          <Text style={pe.winnerText}>No penalty — Winner!</Text>
        </View>
      </View>

      {placements.map((p) => (
        <View key={p} style={pe.row}>
          <Text style={pe.placementLabel}>{PLACEMENT_LABELS[p] ?? `${p}th place`}</Text>
          <TextInput
            style={pe.input}
            value={getDesc(p)}
            onChangeText={(v) => setDesc(p, v)}
            placeholder="e.g. 50 push-ups"
            placeholderTextColor={Colors.textDisabled}
            maxLength={80}
          />
        </View>
      ))}

      <Text style={pe.hint}>
        🏁 Leave empty to skip a placement. The game ends when only one player remains.
      </Text>
    </View>
  );
}

const pe = StyleSheet.create({
  container: { gap: Spacing.sm },
  row:       { gap: 4 },
  placementLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  winnerBadge: {
    backgroundColor: '#F59E0B' + '18', borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
    borderWidth: 1, borderColor: '#F59E0B' + '33',
  },
  winnerText: { fontSize: FontSize.sm, color: '#F59E0B', fontWeight: FontWeight.medium },
  input: {
    backgroundColor: Colors.surfaceElevated, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    fontSize: FontSize.sm, color: Colors.text,
    borderWidth: 1, borderColor: Colors.border,
  },
  hint: { fontSize: FontSize.xs, color: Colors.textMuted, lineHeight: 16, marginTop: 4 },
});

// ── Tabs ───────────────────────────────────────────────────────────────────────

type LobbyTab = 'players' | 'settings' | 'invite';

// ── Main Screen ────────────────────────────────────────────────────────────────

export default function LobbyScreen() {
  const insets   = useSafeAreaInsets();
  const { challenge, updateChallenge, leaveGame } = useGameStore();
  const userId   = useAuthStore((s) => s.user?.id);
  useSocketGame(challenge?.id ?? null);

  const [activeTab,     setActiveTab]     = useState<LobbyTab>('players');
  const [starting,      setStarting]      = useState(false);
  const [saving,        setSaving]        = useState(false);

  // Local settings state (host edits)
  const [startingTime,  setStartingTime]  = useState<number>(challenge?.settings.startingTime ?? 900);
  const [startingCards, setStartingCards] = useState<number>(challenge?.settings.startingCards ?? 0);
  const [penalties,     setPenalties]     = useState<PenaltyRule[]>(challenge?.penalties ?? []);

  const isHost     = challenge?.hostId === userId;
  const players    = challenge?.players ?? [];
  const inviteCode = challenge?.code ?? '';
  const inviteLink = `socialess://join/${inviteCode}`;

  // Sync from socket updates
  useEffect(() => {
    if (!challenge) return;
    setStartingTime(challenge.settings.startingTime ?? 900);
    setStartingCards(challenge.settings.startingCards ?? 0);
    setPenalties(challenge.penalties ?? []);
  }, [challenge?.id]);

  useEffect(() => {
    if (!challenge) { router.replace('/(app)/(tabs)'); return; }
    if (challenge.status === 'active') router.replace('/(app)/(tabs)');
  }, [challenge]);

  const handleSaveSettings = useCallback(async () => {
    if (!challenge || !isHost) return;
    setSaving(true);
    try {
      const updated = await gameService.updateChallengeSettings(
        challenge.id,
        { startingTime, startingCards } as Partial<ChallengeSettings>,
        penalties,
      );
      updateChallenge(updated);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'Could not save settings');
    }
    setSaving(false);
  }, [challenge, startingTime, startingCards, penalties, isHost]);

  const handleShare = async () => {
    await Share.share({
      message: `Join my Socialess challenge!\nCode: ${inviteCode}\nLink: ${inviteLink}`,
      title: 'Socialess Challenge Invite',
    });
  };

  const handleStart = async () => {
    if (!challenge) return;
    setStarting(true);
    try {
      if (isHost) {
        await gameService.updateChallengeSettings(
          challenge.id,
          { startingTime, startingCards } as Partial<ChallengeSettings>,
          penalties,
        );
      }
      await gameService.startChallenge(challenge.id);
      updateChallenge({ status: 'active' });
      router.replace('/(app)/(tabs)');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'Could not start game');
    }
    setStarting(false);
  };

  const handleLeave = () => {
    Alert.alert(
      'Leave Lobby',
      'Are you sure you want to leave?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            if (challenge) await gameService.leaveChallenge(challenge.id);
            leaveGame();
            router.replace('/(app)/(tabs)');
          },
        },
      ],
    );
  };

  if (!challenge) return null;

  // ── Tabs content ─────────────────────────────────────────────────────────────

  const renderPlayers = () => (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>Players ({players.length})</Text>
      <View style={styles.playerList}>
        {players.map((p, idx) => (
          <View key={p.userId} style={[styles.playerRow, idx === players.length - 1 && { borderBottomWidth: 0 }]}>
            <View style={styles.playerAvatar}>
              <Text style={styles.playerAvatarText}>{(p.username ?? '?').charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={styles.playerName} numberOfLines={1}>{p.username}</Text>
            {p.userId === challenge.hostId && (
              <View style={styles.hostBadge}><Text style={styles.hostBadgeText}>Host</Text></View>
            )}
            {p.userId === userId && (
              <View style={styles.meBadge}><Text style={styles.meBadgeText}>You</Text></View>
            )}
          </View>
        ))}
        {players.length < 2 && (
          <View style={styles.waitingForPlayers}>
            <Text style={styles.waitingForPlayersText}>Waiting for players to join…</Text>
          </View>
        )}
      </View>

      {/* Penalties preview */}
      {(challenge.penalties ?? []).length > 0 && (
        <Card style={styles.penaltiesCard}>
          <Text style={styles.penaltiesTitle}>⚠️ Penalties</Text>
          {(challenge.penalties ?? []).map((rule) => (
            <View key={rule.placement} style={styles.penaltyRow}>
              <Text style={styles.penaltyPlacement}>
                {PLACEMENT_LABELS[rule.placement] ?? `${rule.placement}th`}
              </Text>
              <Text style={styles.penaltyDesc}>{rule.description}</Text>
            </View>
          ))}
        </Card>
      )}
    </View>
  );

  const renderSettings = () => (
    <View style={styles.section}>
      {isHost ? (
        <>
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Starting Time</Text>
            <Text style={styles.settingDesc}>Time each player starts with</Text>
            <ChipSelector options={STARTING_TIME_OPTIONS} value={startingTime} onChange={setStartingTime} />
          </View>

          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Starting Cards</Text>
            <Text style={styles.settingDesc}>Cards dealt to each player at game start</Text>
            <ChipSelector options={STARTING_CARDS_OPTIONS} value={startingCards} onChange={setStartingCards} />
          </View>

          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Penalties by Placement</Text>
            <Text style={styles.settingDesc}>
              Assign consequences for each losing position. Game ends when only 1 player remains.
            </Text>
            <PenaltyEditor penalties={penalties} onChange={setPenalties} />
          </View>

          <Button
            label={saving ? 'Saving…' : 'Save Settings'}
            variant="outline"
            onPress={handleSaveSettings}
            loading={saving}
            fullWidth
            size="sm"
          />
        </>
      ) : (
        <View style={styles.readonlySettings}>
          {[
            { label: 'Starting Time',  value: `${Math.round((challenge.settings.startingTime ?? 900) / 60)} min` },
            { label: 'Starting Cards', value: `${challenge.settings.startingCards ?? 0} per player` },
            { label: 'End Condition',  value: 'Last player standing' },
          ].map((item) => (
            <View key={item.label} style={styles.readonlyRow}>
              <Text style={styles.readonlyLabel}>{item.label}</Text>
              <Text style={styles.readonlyValue}>{item.value}</Text>
            </View>
          ))}
          {(challenge.penalties ?? []).length > 0 && (
            <View style={{ gap: Spacing.xs, marginTop: Spacing.sm }}>
              <Text style={styles.readonlyLabel}>⚠️ Penalties</Text>
              {(challenge.penalties ?? []).map((rule) => (
                <View key={rule.placement} style={styles.readonlyRow}>
                  <Text style={styles.readonlyLabel}>{PLACEMENT_LABELS[rule.placement] ?? `${rule.placement}th`}</Text>
                  <Text style={[styles.readonlyValue, { color: Colors.warning }]}>{rule.description}</Text>
                </View>
              ))}
            </View>
          )}
          <Text style={styles.hostOnlyNote}>Only the host can change settings</Text>
        </View>
      )}
    </View>
  );

  const renderInvite = () => (
    <View style={styles.section}>
      <Card elevated style={styles.codeCard}>
        <Text style={styles.codeLabel}>Invite Code</Text>
        <Text style={styles.code}>{inviteCode}</Text>
        <Text style={styles.codeHint}>Share this code with friends so they can join</Text>
      </Card>

      <Button label="Share Invite" onPress={handleShare} fullWidth size="lg" />

      <View style={styles.linkRow}>
        <View style={styles.linkBox}>
          <Text style={styles.linkText} numberOfLines={1}>{inviteLink}</Text>
        </View>
        <TouchableOpacity style={styles.linkCopyBtn} onPress={() => Linking.openURL(inviteLink).catch(() => {})}>
          <Text style={styles.linkCopyText}>Open</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.deepLinkHint}>
        Friends on iOS/Android can tap the link to open directly in Socialess.
      </Text>
    </View>
  );

  return (
    <LinearGradient colors={[Colors.background, '#0D0D1A']} style={styles.gradient}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + Spacing.sm }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with back button */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.replace('/(app)/(tabs)')}
            activeOpacity={0.7}
          >
            <Text style={styles.backIcon}>‹</Text>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.title}>Lobby</Text>
            <View style={styles.modeBadge}>
              <Text style={styles.modeText}>{challenge.mode.toUpperCase()}</Text>
            </View>
          </View>

          {/* Leave button top-right */}
          <TouchableOpacity style={styles.leaveTopBtn} onPress={handleLeave}>
            <Text style={styles.leaveTopText}>Leave</Text>
          </TouchableOpacity>
        </View>

        {/* Tab bar */}
        <View style={styles.tabBar}>
          {(['players', 'settings', 'invite'] as LobbyTab[]).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tabBtn, activeTab === t && styles.tabBtnActive]}
              onPress={() => setActiveTab(t)}
            >
              <Text style={[styles.tabBtnText, activeTab === t && styles.tabBtnTextActive]}>
                {t === 'players' ? `👥 Players` : t === 'settings' ? '⚙️ Settings' : '🔗 Invite'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'players'  && renderPlayers()}
        {activeTab === 'settings' && renderSettings()}
        {activeTab === 'invite'   && renderInvite()}

        {/* Start / waiting */}
        <View style={styles.actions}>
          {isHost ? (
            <Button
              label={
                players.length < 2
                  ? 'Waiting for Players…'
                  : starting
                  ? 'Starting…'
                  : `Start Game (${players.length} players)`
              }
              onPress={handleStart}
              loading={starting}
              fullWidth
              size="lg"
              disabled={players.length < 2 || starting}
            />
          ) : (
            <View style={styles.waitingRow}>
              <View style={styles.waitingDot} />
              <Text style={styles.waitingText}>Waiting for host to start…</Text>
            </View>
          )}
        </View>

        <View style={{ height: Spacing['2xl'] }} />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  scroll:   { padding: Spacing.base, gap: Spacing.base },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: Spacing.xs,
  },
  backBtn:  { flexDirection: 'row', alignItems: 'center', gap: 2, padding: 4, minWidth: 56 },
  backIcon: { fontSize: 28, color: Colors.primary, lineHeight: 30 },
  backText: { fontSize: FontSize.base, color: Colors.primary, fontWeight: FontWeight.semibold },
  headerCenter: { flex: 1, alignItems: 'center', gap: 4 },
  title:    { fontSize: FontSize.xl, fontWeight: FontWeight.heavy, color: Colors.text },
  modeBadge: {
    borderRadius: Radius.full, borderWidth: 1,
    paddingHorizontal: Spacing.sm, paddingVertical: 3,
    borderColor: Colors.primary + '44', backgroundColor: Colors.primary + '11',
  },
  modeText: { fontSize: FontSize.xs, fontWeight: FontWeight.heavy, color: Colors.primary, letterSpacing: 1 },
  leaveTopBtn: { minWidth: 56, alignItems: 'flex-end', padding: 4 },
  leaveTopText: { fontSize: FontSize.sm, color: Colors.danger, fontWeight: FontWeight.semibold },

  // Tab bar
  tabBar: { flexDirection: 'row', backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg, padding: 3, gap: 3 },
  tabBtn: { flex: 1, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center' },
  tabBtnActive:     { backgroundColor: Colors.primary + '22' },
  tabBtnText:       { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: FontWeight.semibold },
  tabBtnTextActive: { color: Colors.primary },

  section:      { gap: Spacing.md },
  sectionLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.heavy, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.2 },

  // Players
  playerList: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  playerRow:  { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: Spacing.sm },
  playerAvatar:     { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary + '33', alignItems: 'center', justifyContent: 'center' },
  playerAvatarText: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.primary },
  playerName:       { flex: 1, fontSize: FontSize.base, color: Colors.text, fontWeight: FontWeight.medium },
  hostBadge: { backgroundColor: Colors.warning + '22', borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  hostBadgeText: { fontSize: FontSize.xs, color: Colors.warning, fontWeight: FontWeight.semibold },
  meBadge:       { backgroundColor: Colors.primary + '22', borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  meBadgeText:   { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold },
  waitingForPlayers:     { padding: Spacing.md, alignItems: 'center' },
  waitingForPlayersText: { fontSize: FontSize.sm, color: Colors.textMuted },

  // Penalties preview in players tab
  penaltiesCard:  { gap: Spacing.sm },
  penaltiesTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.heavy, color: Colors.warning },
  penaltyRow:     { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  penaltyPlacement: { fontSize: FontSize.sm, color: Colors.textMuted, width: 90 },
  penaltyDesc:      { fontSize: FontSize.sm, color: Colors.text, flex: 1 },

  // Settings
  settingItem: { gap: Spacing.xs },
  settingLabel: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.text },
  settingDesc:  { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 2 },
  readonlySettings: { gap: Spacing.sm },
  readonlyRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  readonlyLabel: { fontSize: FontSize.base, color: Colors.textMuted },
  readonlyValue: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.text, flex: 1, textAlign: 'right' },
  hostOnlyNote:  { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.sm },

  // Invite
  codeCard:  { alignItems: 'center', gap: Spacing.sm },
  codeLabel: { fontSize: FontSize.sm, color: Colors.textMuted },
  code:      { fontSize: FontSize['4xl'], fontWeight: FontWeight.heavy, color: Colors.text, letterSpacing: 8, fontVariant: ['tabular-nums'] },
  codeHint:  { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center' },
  linkRow:   { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  linkBox:   { flex: 1, backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  linkText:  { fontSize: FontSize.sm, color: Colors.textSecondary, fontFamily: 'monospace' as any },
  linkCopyBtn:  { backgroundColor: Colors.primary + '22', borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderWidth: 1, borderColor: Colors.primary + '44' },
  linkCopyText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold },
  deepLinkHint: { fontSize: FontSize.xs, color: Colors.textMuted, lineHeight: 18, textAlign: 'center' },

  // Actions
  actions:     { gap: Spacing.sm, marginTop: Spacing.md },
  waitingRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
  waitingDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
  waitingText: { fontSize: FontSize.base, color: Colors.textSecondary },
});
