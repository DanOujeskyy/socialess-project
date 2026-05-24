import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../theme';
import { cardsService } from '../../services/cards.service';
import { useGameStore } from '../../store/game.store';
import { GameCardItem } from '../cards/GameCardItem';
import type { Crate, GameCard } from '../../types';

interface CrateOpenerProps {
  crate: Crate;
  onOpened?: (card: GameCard) => void;
}

export function CrateOpener({ crate, onOpened }: CrateOpenerProps) {
  const [isOpening, setIsOpening] = useState(false);
  const [reward, setReward] = useState<GameCard | null>(null);
  const shakeAnim = new Animated.Value(0);
  const { openCrate, addCard } = useGameStore();

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleOpen = async () => {
    if (isOpening || crate.opened) return;
    setIsOpening(true);
    shake();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      const card = await cardsService.openCrate(crate.id);
      setTimeout(() => {
        setReward(card);
        openCrate(crate.id, card);
        addCard(card);
        onOpened?.(card);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }, 500);
    } catch {
      setIsOpening(false);
    }
  };

  const crateIcon = crate.type === 'premium' ? '💎' : crate.type === 'ad' ? '📺' : '📦';
  const crateLabel = crate.type === 'premium' ? 'Premium Crate' : crate.type === 'ad' ? 'Ad Crate' : 'Basic Crate';

  if (reward) {
    return (
      <View style={styles.rewardContainer}>
        <Text style={styles.rewardTitle}>You got!</Text>
        <GameCardItem card={reward} style={styles.rewardCard} />
      </View>
    );
  }

  return (
    <TouchableOpacity onPress={handleOpen} disabled={crate.opened || isOpening} activeOpacity={0.8}>
      <Animated.View
        style={[
          styles.crate,
          crate.opened && styles.opened,
          { transform: [{ translateX: shakeAnim }] },
        ]}
      >
        <Text style={styles.crateIcon}>{crateIcon}</Text>
        <Text style={styles.crateLabel}>{crateLabel}</Text>
        {!crate.opened && <Text style={styles.tapHint}>{isOpening ? 'Opening…' : 'Tap to open'}</Text>}
        {crate.opened && <Text style={styles.openedLabel}>Opened</Text>}
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  crate: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primary + '55',
    gap: Spacing.xs,
  },
  opened: { opacity: 0.4, borderColor: Colors.border },
  crateIcon: { fontSize: 48 },
  crateLabel: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.text },
  tapHint: { fontSize: FontSize.sm, color: Colors.textMuted },
  openedLabel: { fontSize: FontSize.sm, color: Colors.textMuted },
  rewardContainer: { alignItems: 'center', gap: Spacing.md },
  rewardTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text },
  rewardCard: { width: 160 },
});
