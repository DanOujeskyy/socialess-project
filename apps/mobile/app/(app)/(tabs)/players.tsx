import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useGameStore } from '../../../src/store/game.store';
import { useAuthStore } from '../../../src/store/auth.store';
import { PlayerCard } from '../../../src/components/players/PlayerCard';
import { Modal } from '../../../src/components/ui/Modal';
import { GameCardItem } from '../../../src/components/cards/GameCardItem';
import { Button } from '../../../src/components/ui/Button';
import { Colors, FontSize, FontWeight, Spacing } from '../../../src/theme';
import { gameService } from '../../../src/services/game.service';
import { cardsService } from '../../../src/services/cards.service';
import type { GameCard, PlayerState } from '../../../src/types';

export default function PlayersScreen() {
  const insets = useSafeAreaInsets();
  const challenge = useGameStore((s) => s.challenge);
  const myCards = useGameStore((s) => s.myCards);
  const removeCard = useGameStore((s) => s.removeCard);
  const userId = useAuthStore((s) => s.user?.id);
  const [refreshing, setRefreshing] = useState(false);
  const [targetPlayer, setTargetPlayer] = useState<PlayerState | null>(null);
  const [sendingCard, setSendingCard] = useState(false);

  const players = challenge?.players ?? [];
  const me = players.find((p) => p.userId === userId);
  const others = players.filter((p) => p.userId !== userId);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (challenge) {
        const updated = await gameService.getChallenge(challenge.id);
        useGameStore.getState().setChallenge(updated);
      }
    } catch {}
    setRefreshing(false);
  };

  const unusedCards = myCards.filter((c) => !c.usedAt);

  const handleSendCard = async (card: GameCard) => {
    if (!targetPlayer) return;
    setSendingCard(true);
    try {
      await cardsService.useCard(card.id, targetPlayer.userId);
      removeCard(card.id);
      setTargetPlayer(null);
    } catch {}
    setSendingCard(false);
  };

  if (!challenge) {
    return (
      <LinearGradient colors={[Colors.background, '#0D0D1A']} style={styles.gradient}>
        <View style={styles.noGame}>
          <Text style={styles.noGameIcon}>👥</Text>
          <Text style={styles.noGameText}>Join or start a multiplayer game to see players.</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={[Colors.background, '#0D0D1A']} style={styles.gradient}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + Spacing.base }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Players</Text>
          <Text style={styles.subtitle}>{players.length} in game · Code: {challenge.code}</Text>
        </View>

        {me && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>You</Text>
            <PlayerCard player={me} isMe />
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Opponents ({others.length})</Text>
          {others.length === 0 ? (
            <Text style={styles.noPlayers}>No other players yet.</Text>
          ) : (
            <View style={styles.playerList}>
              {others
                .sort((a, b) => b.currentTime - a.currentTime)
                .map((p) => (
                  <PlayerCard
                    key={p.userId}
                    player={p}
                    onSendCard={() => setTargetPlayer(p)}
                  />
                ))}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={!!targetPlayer}
        onClose={() => setTargetPlayer(null)}
        title={`Send card to ${targetPlayer?.username}`}
      >
        {unusedCards.length === 0 ? (
          <View style={styles.noCards}>
            <Text style={styles.noCardsText}>You have no cards to send.</Text>
          </View>
        ) : (
          <View style={styles.cardGrid}>
            {unusedCards.map((card) => (
              <GameCardItem
                key={card.id}
                card={card}
                onPress={handleSendCard}
                style={styles.cardGridItem}
                compact
              />
            ))}
          </View>
        )}
        <Button label="Cancel" variant="ghost" onPress={() => setTargetPlayer(null)} style={{ marginTop: Spacing.md }} />
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  scroll: { padding: Spacing.base, gap: Spacing.base },
  header: { gap: 2 },
  title: { fontSize: FontSize['2xl'], fontWeight: FontWeight.heavy, color: Colors.text },
  subtitle: { fontSize: FontSize.sm, color: Colors.textMuted },
  section: { gap: Spacing.sm },
  sectionLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  playerList: { gap: Spacing.sm },
  noPlayers: { fontSize: FontSize.base, color: Colors.textMuted, textAlign: 'center', paddingVertical: Spacing.xl },
  noGame: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  noGameIcon: { fontSize: 48 },
  noGameText: { fontSize: FontSize.base, color: Colors.textMuted, textAlign: 'center', paddingHorizontal: Spacing.xl },
  noCards: { alignItems: 'center', paddingVertical: Spacing.xl },
  noCardsText: { fontSize: FontSize.base, color: Colors.textMuted },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  cardGridItem: { width: '47%' },
});
