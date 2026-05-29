import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Animated, Easing, Dimensions, Modal, Pressable,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGameStore } from '../../../src/store/game.store';
import { GameCardItem } from '../../../src/components/cards/GameCardItem';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../../src/theme';
import { cardsService } from '../../../src/services/cards.service';
import { useAuthStore } from '../../../src/store/auth.store';
import { CARD_NAMES, CARD_DESCRIPTIONS } from '../../../src/constants';
import type { GameCard, PlayerState } from '../../../src/types';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const CARD_W = Math.min(112, Math.floor((SCREEN_W - 48) / 3));

// ── Rarity tokens (mirrored from GameCardItem for the detail sheet) ────────────

const RARITY = {
  common:    { color: '#9CA3AF', bg: '#1A1D25', glow: 'rgba(156,163,175,0.15)' },
  rare:      { color: '#3B82F6', bg: '#0B1930', glow: 'rgba(59,130,246,0.22)' },
  epic:      { color: '#A855F7', bg: '#1A0B32', glow: 'rgba(168,85,247,0.25)' },
  legendary: { color: '#F59E0B', bg: '#1F1100', glow: 'rgba(245,158,11,0.30)' },
} as const;

// ── Floating particles (success effect) ───────────────────────────────────────

function Particle({ color, delay }: { color: string; delay: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.timing(anim, {
        toValue: 1, duration: 800,
        easing: Easing.out(Easing.ease), useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const x = (Math.random() - 0.5) * 160;
  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: 8, height: 8, borderRadius: 4,
        backgroundColor: color,
        opacity: anim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 0] }),
        transform: [
          { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [0, x] }) },
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -120] }) },
          { scale:      anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1.2, 0.4] }) },
        ],
      }}
    />
  );
}

// ── Card Detail + Play bottom sheet ──────────────────────────────────────────

type PlayStep = 'detail' | 'target' | 'playing' | 'success' | 'error';

interface CardDetailSheetProps {
  card: GameCard | null;
  targets: PlayerState[];
  onClose: () => void;
  onPlayed: (cardId: string) => void;
}

function CardDetailSheet({ card, targets, onClose, onPlayed }: CardDetailSheetProps) {
  const slideY  = useRef(new Animated.Value(SCREEN_H)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(1)).current;

  const [step,         setStep]         = useState<PlayStep>('detail');
  const [selectedTarget, setSelectedTarget] = useState<PlayerState | null>(null);
  const [errorMsg,     setErrorMsg]     = useState('');
  const [showParticles, setShowParticles] = useState(false);

  const visible = card !== null;

  React.useEffect(() => {
    if (visible) {
      setStep('detail');
      setSelectedTarget(null);
      setErrorMsg('');
      setShowParticles(false);
      Animated.parallel([
        Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 200 }),
        Animated.timing(bgOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideY, { toValue: SCREEN_H, duration: 300, easing: Easing.in(Easing.ease), useNativeDriver: true }),
        Animated.timing(bgOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const handleSelectTarget = async (target: PlayerState) => {
    if (!card) return;
    setSelectedTarget(target);
    setStep('playing');

    // Animate card play: scale up then disappear
    Animated.sequence([
      Animated.timing(cardScale, { toValue: 1.15, duration: 200, useNativeDriver: true }),
      Animated.timing(cardScale, { toValue: 0,    duration: 250, easing: Easing.in(Easing.ease), useNativeDriver: true }),
    ]).start();

    try {
      await cardsService.useCard(card.id, target.userId);
      setShowParticles(true);
      setStep('success');
      onPlayed(card.id);
      // Auto-close after showing success
      setTimeout(onClose, 1800);
    } catch (e: any) {
      Animated.spring(cardScale, { toValue: 1, useNativeDriver: true }).start();
      setErrorMsg(e?.response?.data?.message ?? 'Could not play this card. Try again.');
      setStep('error');
    }
  };

  if (!card) return null;
  const rarity = RARITY[card.rarity] ?? RARITY.common;
  const cardName = CARD_NAMES[card.type] ?? card.type.replace(/_/g, ' ');
  const cardDesc = CARD_DESCRIPTIONS[card.type as keyof typeof CARD_DESCRIPTIONS] ?? '';

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <Animated.View style={[sheet.backdrop, { opacity: bgOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={step === 'detail' ? onClose : undefined} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[sheet.container, { transform: [{ translateY: slideY }] }]}>
        <LinearGradient
          colors={[rarity.bg, Colors.surface]}
          style={sheet.gradient}
        >
          {/* Handle */}
          <View style={sheet.handle} />

          {/* Glow ring */}
          <View style={[sheet.glowRing, { borderColor: rarity.color + '55', backgroundColor: rarity.glow }]} />

          {/* Card preview */}
          <Animated.View style={[sheet.cardPreview, { transform: [{ scale: cardScale }] }]}>
            <GameCardItem card={card} size="lg" />
          </Animated.View>

          {/* Content by step */}
          {step === 'detail' && (
            <View style={sheet.body}>
              <Text style={[sheet.cardName, { color: rarity.color }]}>{cardName}</Text>
              <View style={[sheet.rarityPill, { backgroundColor: rarity.color + '22', borderColor: rarity.color + '55' }]}>
                <Text style={[sheet.rarityText, { color: rarity.color }]}>
                  {card.rarity.toUpperCase()}
                </Text>
              </View>
              <Text style={sheet.desc}>{cardDesc}</Text>

              {targets.length > 0 ? (
                <TouchableOpacity
                  style={[sheet.playBtn, { backgroundColor: rarity.color }]}
                  onPress={() => setStep('target')}
                  activeOpacity={0.85}
                >
                  <Text style={sheet.playBtnText}>🎯 Choose Target</Text>
                </TouchableOpacity>
              ) : (
                <View style={sheet.noTargets}>
                  <Text style={sheet.noTargetsText}>No active opponents to target</Text>
                </View>
              )}

              <TouchableOpacity onPress={onClose} style={sheet.cancelLink}>
                <Text style={sheet.cancelLinkText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 'target' && (
            <View style={sheet.body}>
              <Text style={sheet.targetTitle}>Choose a target</Text>
              <Text style={sheet.targetSub}>Who do you want to apply this card to?</Text>
              <View style={sheet.targetList}>
                {targets.map((p) => (
                  <TouchableOpacity
                    key={p.userId}
                    style={sheet.targetRow}
                    onPress={() => handleSelectTarget(p)}
                    activeOpacity={0.8}
                  >
                    <View style={sheet.targetAvatar}>
                      <Text style={sheet.targetAvatarText}>
                        {(p.username ?? '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={sheet.targetInfo}>
                      <Text style={sheet.targetName}>{p.username}</Text>
                      <Text style={sheet.targetTime}>
                        {Math.floor((p.currentTime ?? 0) / 60)}m remaining
                      </Text>
                    </View>
                    <Text style={[sheet.targetArrow, { color: rarity.color }]}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity onPress={() => setStep('detail')} style={sheet.cancelLink}>
                <Text style={sheet.cancelLinkText}>← Back</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 'playing' && (
            <View style={sheet.feedbackBox}>
              <ActivityIndicator color={rarity.color} size="large" />
              <Text style={[sheet.feedbackTitle, { color: rarity.color }]}>Playing card…</Text>
            </View>
          )}

          {step === 'success' && (
            <View style={sheet.feedbackBox}>
              {showParticles && Array.from({ length: 8 }).map((_, i) => (
                <Particle key={i} color={rarity.color} delay={i * 60} />
              ))}
              <Text style={sheet.successEmoji}>✅</Text>
              <Text style={[sheet.feedbackTitle, { color: rarity.color }]}>Card played!</Text>
              <Text style={sheet.feedbackSub}>
                {cardName} applied to {selectedTarget?.username}
              </Text>
            </View>
          )}

          {step === 'error' && (
            <View style={sheet.body}>
              <Text style={sheet.errorEmoji}>❌</Text>
              <Text style={sheet.feedbackTitle}>Could not play card</Text>
              <Text style={sheet.feedbackSub}>{errorMsg}</Text>
              <TouchableOpacity
                style={[sheet.playBtn, { backgroundColor: Colors.surfaceElevated, marginTop: Spacing.md }]}
                onPress={() => setStep('detail')}
                activeOpacity={0.8}
              >
                <Text style={[sheet.playBtnText, { color: Colors.text }]}>Try Again</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={sheet.cancelLink}>
                <Text style={sheet.cancelLinkText}>Close</Text>
              </TouchableOpacity>
            </View>
          )}
        </LinearGradient>
      </Animated.View>
    </Modal>
  );
}

const sheet = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  container: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    overflow: 'hidden',
    maxHeight: SCREEN_H * 0.82,
  },
  gradient: { paddingBottom: 40 },

  handle: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)', marginTop: 12, marginBottom: 4,
  },
  glowRing: {
    alignSelf: 'center', width: 120, height: 120, borderRadius: 60,
    borderWidth: 1.5, marginVertical: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  cardPreview: { alignSelf: 'center', marginTop: -68 /* overlap glow */ },

  body: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, gap: Spacing.sm, alignItems: 'center' },

  cardName: { fontSize: FontSize.xl, fontWeight: FontWeight.heavy, textAlign: 'center' },
  rarityPill: {
    borderRadius: Radius.full, borderWidth: 1,
    paddingHorizontal: Spacing.md, paddingVertical: 3,
  },
  rarityText: { fontSize: FontSize.xs, fontWeight: FontWeight.heavy, letterSpacing: 1 },
  desc: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, maxWidth: 280 },

  playBtn: {
    borderRadius: Radius.lg, width: '100%',
    height: 52, alignItems: 'center', justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  playBtnText: { fontSize: FontSize.base, fontWeight: FontWeight.heavy, color: '#fff' },

  noTargets: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg, padding: Spacing.md,
    width: '100%', alignItems: 'center',
  },
  noTargetsText: { fontSize: FontSize.sm, color: Colors.textMuted },

  cancelLink:     { paddingVertical: Spacing.sm },
  cancelLinkText: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },

  // Target step
  targetTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.heavy, color: Colors.text },
  targetSub:   { fontSize: FontSize.sm, color: Colors.textMuted },
  targetList:  { width: '100%', gap: Spacing.xs },
  targetRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  targetAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primary + '22',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.primary + '44',
  },
  targetAvatarText: { fontSize: FontSize.lg, fontWeight: FontWeight.heavy, color: Colors.primary },
  targetInfo:       { flex: 1, gap: 2 },
  targetName:       { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.text },
  targetTime:       { fontSize: FontSize.xs, color: Colors.textMuted },
  targetArrow:      { fontSize: 22, fontWeight: FontWeight.heavy },

  // Feedback
  feedbackBox: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xl, alignItems: 'center', gap: Spacing.md },
  feedbackTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.heavy, color: Colors.text },
  feedbackSub:   { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },
  successEmoji: { fontSize: 52 },
  errorEmoji:   { fontSize: 52 },
});

// ── Main cards screen ─────────────────────────────────────────────────────────

export default function CardsScreen() {
  const insets    = useSafeAreaInsets();
  const myCards   = useGameStore((s) => s.myCards);
  const challenge = useGameStore((s) => s.challenge);
  const removeCard = useGameStore((s) => s.removeCard);
  const userId    = useAuthStore((s) => s.user?.id);

  const [selectedCard, setSelectedCard] = useState<GameCard | null>(null);

  const unusedCards = myCards.filter((c) => !c.usedAt);
  const usedCards   = myCards.filter((c) => !!c.usedAt);

  const otherPlayers = challenge?.players.filter(
    (p) => p.userId !== userId && !p.isEliminated,
  ) ?? [];

  const handleUseCard = useCallback((card: GameCard) => {
    setSelectedCard(card);
  }, []);

  const handlePlayed = useCallback((cardId: string) => {
    removeCard(cardId);
  }, [removeCard]);

  return (
    <LinearGradient colors={[Colors.background, '#0D0D1A']} style={styles.gradient}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + Spacing.base }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>My Cards</Text>
          {unusedCards.length > 0 && (
            <View style={styles.countPill}>
              <Text style={styles.countText}>{unusedCards.length} ready</Text>
            </View>
          )}
        </View>

        {/* Empty state */}
        {unusedCards.length === 0 && usedCards.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🃏</Text>
            <Text style={styles.emptyTitle}>No cards yet</Text>
            <Text style={styles.emptyDesc}>
              Open crates in the Shop or win challenges to earn cards.
            </Text>
          </View>
        )}

        {/* Available cards */}
        {unusedCards.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel}>Available</Text>
              <Text style={styles.sectionCount}>{unusedCards.length}</Text>
            </View>
            {otherPlayers.length === 0 && (
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  {'⚔️ Join a challenge to use cards against opponents'}
                </Text>
              </View>
            )}
            <View style={styles.grid}>
              {unusedCards.map((card) => (
                <GameCardItem
                  key={card.id}
                  card={card}
                  onPress={handleUseCard}
                  size="md"
                  style={{ width: CARD_W }}
                />
              ))}
            </View>
          </View>
        )}

        {/* Used cards */}
        {usedCards.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel}>Used</Text>
              <Text style={styles.sectionCount}>{usedCards.length}</Text>
            </View>
            <View style={styles.grid}>
              {usedCards.map((card) => (
                <GameCardItem
                  key={card.id}
                  card={card}
                  isUsed
                  size="md"
                  style={{ width: CARD_W }}
                />
              ))}
            </View>
          </View>
        )}

        <View style={{ height: Spacing['2xl'] }} />
      </ScrollView>

      {/* Card detail + play bottom sheet */}
      <CardDetailSheet
        card={selectedCard}
        targets={otherPlayers}
        onClose={() => setSelectedCard(null)}
        onPlayed={handlePlayed}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  scroll:   { padding: Spacing.base, gap: Spacing.lg },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
  },
  title: { fontSize: FontSize['2xl'], fontWeight: FontWeight.heavy, color: Colors.text, flex: 1 },
  countPill: {
    backgroundColor: Colors.primary + '1A',
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.primary + '44',
    paddingHorizontal: Spacing.md, paddingVertical: 5,
  },
  countText: { fontSize: FontSize.sm, color: Colors.primaryLight, fontWeight: FontWeight.semibold },

  empty: { alignItems: 'center', paddingVertical: Spacing['4xl'], gap: Spacing.sm },
  emptyIcon:  { fontSize: 52 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  emptyDesc:  { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', maxWidth: 260 },

  section:    { gap: Spacing.sm },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sectionLabel: {
    fontSize: FontSize.xs, fontWeight: FontWeight.heavy,
    color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.2,
  },
  sectionCount: {
    fontSize: FontSize.xs, fontWeight: FontWeight.heavy,
    color: Colors.primary, backgroundColor: Colors.primary + '18',
    borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2,
    borderWidth: 1, borderColor: Colors.primary + '33',
  },

  infoBox: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg, padding: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  infoText: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },
});
