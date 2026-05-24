import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  FlatList,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useGameStore } from '../../../src/store/game.store';
import { GameCardItem } from '../../../src/components/cards/GameCardItem';
import { Modal } from '../../../src/components/ui/Modal';
import { PlayerCard } from '../../../src/components/players/PlayerCard';
import { Button } from '../../../src/components/ui/Button';
import { Colors, FontSize, FontWeight, Spacing } from '../../../src/theme';
import { cardsService } from '../../../src/services/cards.service';
import { useAuthStore } from '../../../src/store/auth.store';
import type { GameCard, PlayerState } from '../../../src/types';

export default function CardsScreen() {
  const insets = useSafeAreaInsets();
  const myCards = useGameStore((s) => s.myCards);
  const challenge = useGameStore((s) => s.challenge);
  const removeCard = useGameStore((s) => s.removeCard);
  const userId = useAuthStore((s) => s.user?.id);

  const [selectedCard, setSelectedCard] = useState<GameCard | null>(null);
  const [targetModalVisible, setTargetModalVisible] = useState(false);

  const unusedCards = myCards.filter((c) => !c.usedAt);
  const usedCards   = myCards.filter((c) => !!c.usedAt);

  const otherPlayers = challenge?.players.filter(
    (p) => p.userId !== userId && !p.isEliminated,
  ) ?? [];

  const handleUseCard = (card: GameCard) => {
    if (otherPlayers.length === 0) {
      Alert.alert('No targets', 'No other players to use this card on.');
      return;
    }
    setSelectedCard(card);
    setTargetModalVisible(true);
  };

  const handleSelectTarget = async (target: PlayerState) => {
    if (!selectedCard) return;
    setTargetModalVisible(false);
    try {
      await cardsService.useCard(selectedCard.id, target.userId);
      removeCard(selectedCard.id);
      Alert.alert('Card used!', `${selectedCard.type.replace(/_/g, ' ')} applied to ${target.username}.`);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'Could not use card');
    }
    setSelectedCard(null);
  };

  return (
    <LinearGradient colors={[Colors.background, '#0D0D1A']} style={styles.gradient}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + Spacing.base }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Your Cards</Text>
        <Text style={styles.subtitle}>{unusedCards.length} unused · {usedCards.length} used</Text>

        {unusedCards.length === 0 && usedCards.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🃏</Text>
            <Text style={styles.emptyText}>No cards yet. Open crates to get cards!</Text>
          </View>
        )}

        {unusedCards.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Available</Text>
            <View style={styles.grid}>
              {unusedCards.map((card) => (
                <GameCardItem
                  key={card.id}
                  card={card}
                  onPress={handleUseCard}
                  style={styles.cardItem}
                />
              ))}
            </View>
          </View>
        )}

        {usedCards.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Used</Text>
            <View style={styles.grid}>
              {usedCards.map((card) => (
                <GameCardItem
                  key={card.id}
                  card={card}
                  isUsed
                  style={styles.cardItem}
                />
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={targetModalVisible}
        onClose={() => { setTargetModalVisible(false); setSelectedCard(null); }}
        title="Choose Target"
      >
        <View style={styles.targetList}>
          {otherPlayers.map((p) => (
            <PlayerCard
              key={p.userId}
              player={p}
              onSendCard={() => handleSelectTarget(p)}
            />
          ))}
        </View>
        <Button label="Cancel" variant="ghost" onPress={() => { setTargetModalVisible(false); setSelectedCard(null); }} style={{ marginTop: Spacing.md }} />
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  scroll: { padding: Spacing.base, gap: Spacing.base },
  title: { fontSize: FontSize['2xl'], fontWeight: FontWeight.heavy, color: Colors.text },
  subtitle: { fontSize: FontSize.sm, color: Colors.textMuted },
  empty: { alignItems: 'center', paddingVertical: Spacing['4xl'], gap: Spacing.md },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: FontSize.base, color: Colors.textMuted, textAlign: 'center' },
  section: { gap: Spacing.sm },
  sectionLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  cardItem: { width: '47%' },
  targetList: { gap: Spacing.sm },
});
