/**
 * DailyCrateCard — standalone "claim free crate" hero card for the Shop.
 * CrateOpener    — inline purchased/ad crate item (in a list).
 *
 * Both include a mock fallback so they work in dev / Expo Go without a backend.
 */

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../theme';
import { cardsService } from '../../services/cards.service';
import { useGameStore } from '../../store/game.store';
import { GameCardItem } from '../cards/GameCardItem';
import type { Crate, GameCard, GameCardType, Rarity } from '../../types';

// ── Mock card generator (dev fallback when backend unavailable) ───────────────

const MOCK_TYPES: GameCardType[] = [
  'nerf_activities', 'buff_activities', 'reduce_time',
  'increase_time', 'ban_activity', 'limit_time_capacity',
];
const MOCK_RARITIES: Rarity[] = ['common', 'common', 'common', 'common', 'rare', 'rare', 'epic'];

function makeMockCard(): GameCard {
  const type   = MOCK_TYPES[Math.floor(Math.random() * MOCK_TYPES.length)];
  const rarity = MOCK_RARITIES[Math.floor(Math.random() * MOCK_RARITIES.length)];
  return {
    id:          `mock_${Date.now()}`,
    type,
    rarity,
    effect:      { type, rarity, value: 1 },
    obtainedAt:  new Date().toISOString(),
  };
}

// ── Drop-rate bar (cosmetic) ───────────────────────────────────────────────────

const DROP_RATES = [
  { label: 'Common',    pct: '60%', color: '#6B7280' },
  { label: 'Rare',      pct: '25%', color: '#3B82F6' },
  { label: 'Epic',      pct: '12%', color: '#A855F7' },
  { label: 'Legendary', pct: '3%',  color: '#F59E0B' },
];

function DropRates() {
  return (
    <View style={drStyles.row}>
      {DROP_RATES.map((r) => (
        <View key={r.label} style={drStyles.item}>
          <View style={[drStyles.dot, { backgroundColor: r.color }]} />
          <Text style={drStyles.label}>{r.pct}</Text>
          <Text style={drStyles.rarity}>{r.label}</Text>
        </View>
      ))}
    </View>
  );
}
const drStyles = StyleSheet.create({
  row:    { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' },
  item:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot:    { width: 7, height: 7, borderRadius: 4 },
  label:  { fontSize: 10, fontWeight: '700', color: Colors.text },
  rarity: { fontSize: 10, color: Colors.textMuted },
});

// ── DailyCrateCard ─────────────────────────────────────────────────────────────
// The hero "Free Daily Crate" section at the top of the shop.

interface DailyCrateCardProps {
  available: boolean;
  onClaimed: (card: GameCard) => void;
  onUnavailable: () => void;
}

export function DailyCrateCard({ available, onClaimed, onUnavailable }: DailyCrateCardProps) {
  const [opening, setOpening] = useState(false);
  const [reward,  setReward]  = useState<GameCard | null>(null);

  const shakeAnim  = useRef(new Animated.Value(0)).current;
  const glowAnim   = useRef(new Animated.Value(0)).current;
  const revealAnim = useRef(new Animated.Value(0)).current;

  const { addCard, setHasFreeCrateAvailable } = useGameStore();

  const runOpen = async () => {
    if (opening || !available) return;
    setOpening(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Shake
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue:  12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:   8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:   0, duration: 60, useNativeDriver: true }),
    ]).start();

    // Attempt API, fall back to mock in dev
    let card: GameCard;
    try {
      card = await cardsService.openCrate('daily_free');
    } catch {
      if (__DEV__) {
        card = makeMockCard();
      } else {
        Alert.alert('Error', 'Could not open crate. Try again later.');
        setOpening(false);
        return;
      }
    }

    // Glow → reveal
    Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 200, useNativeDriver: false }),
      Animated.timing(glowAnim, { toValue: 0, duration: 250, useNativeDriver: false }),
    ]).start(() => {
      setReward(card);
      addCard(card);
      setHasFreeCrateAvailable(false);
      onClaimed(card);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Animated.spring(revealAnim, {
        toValue: 1, friction: 5, tension: 80, useNativeDriver: true,
      }).start();
    });
  };

  // ── Reward state ────────────────────────────────────────────────────────

  if (reward) {
    return (
      <LinearGradient colors={['#0F1A2E', '#1A0B32']} style={[s.heroCard, { borderColor: '#A855F7' + '88' }]}>
        <Text style={s.heroYouGot}>You got!</Text>
        <Animated.View style={{ transform: [{ scale: revealAnim }], alignItems: 'center' }}>
          <GameCardItem card={reward} size="lg" />
        </Animated.View>
        <View style={[s.rarityBadge, { borderColor: Colors.rarity[reward.rarity] + '77' }]}>
          <Text style={[s.rarityBadgeText, { color: Colors.rarity[reward.rarity] }]}>
            {reward.rarity.toUpperCase()} · {reward.type.replace(/_/g, ' ').toUpperCase()}
          </Text>
        </View>
        <Text style={s.heroClaimedHint}>Come back tomorrow for another free crate</Text>
      </LinearGradient>
    );
  }

  // ── Crate box ────────────────────────────────────────────────────────────

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.65] });

  return (
    <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
      <LinearGradient
        colors={available ? ['#1A1208', '#241A0A', '#1A1208'] : ['#131313', '#1A1A1A']}
        style={[s.heroCard, { borderColor: available ? '#C49A3C' : Colors.border }]}
      >
        {/* Glow flash overlay */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: '#F59E0B', opacity: glowOpacity, borderRadius: Radius['2xl'] - 2 }]}
          pointerEvents="none"
        />

        {/* Chest area */}
        <View style={s.heroChestWrap}>
          {/* Outer glow ring */}
          {available && (
            <View style={s.heroGlowRing} />
          )}
          <View style={[s.heroChest, { backgroundColor: available ? '#2A1E0A' : '#1A1A1A' }]}>
            <Text style={s.heroChestIcon}>{available ? '🪙' : '📭'}</Text>
          </View>
        </View>

        <Text style={[s.heroTitle, { color: available ? '#FCD34D' : Colors.textMuted }]}>
          {available ? 'Free Daily Crate' : 'Already Claimed'}
        </Text>
        <Text style={s.heroSubtitle}>
          {available
            ? 'Opens at 4 AM · Resets daily'
            : 'Come back tomorrow'}
        </Text>

        {available && (
          <>
            <DropRates />
            <TouchableOpacity
              style={[s.heroBtn, opening && s.heroBtnLoading]}
              onPress={runOpen}
              disabled={opening}
              activeOpacity={0.82}
            >
              <Text style={s.heroBtnText}>
                {opening ? 'Opening…' : '✦  Open Crate  ✦'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </LinearGradient>
    </Animated.View>
  );
}

// ── CrateOpener (purchased / ad crates in a list) ─────────────────────────────

interface CrateOpenerProps {
  crate:     Crate;
  onOpened?: (card: GameCard) => void;
}

export function CrateOpener({ crate, onOpened }: CrateOpenerProps) {
  const [opening, setOpening] = useState(false);
  const [reward,  setReward]  = useState<GameCard | null>(crate.reward ?? null);
  const shakeAnim  = useRef(new Animated.Value(0)).current;
  const revealAnim = useRef(new Animated.Value(0)).current;
  const { openCrate, addCard } = useGameStore();

  const cfg = CRATE_CFG[crate.type];

  const handleOpen = async () => {
    if (opening || crate.opened) return;
    setOpening(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    Animated.sequence([
      Animated.timing(shakeAnim, { toValue:  9, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -9, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  6, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  0, duration: 55, useNativeDriver: true }),
    ]).start();

    let card: GameCard;
    try {
      card = await cardsService.openCrate(crate.id);
    } catch {
      if (__DEV__) {
        card = makeMockCard();
        await new Promise(r => setTimeout(r, 300));
      } else {
        Alert.alert('Error', 'Could not open crate. Try again later.');
        setOpening(false);
        return;
      }
    }

    openCrate(crate.id, card);
    addCard(card);
    onOpened?.(card);
    setReward(card);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.spring(revealAnim, {
      toValue: 1, friction: 5, tension: 80, useNativeDriver: true,
    }).start();
  };

  if (reward) {
    return (
      <View style={s.inlineReward}>
        <Text style={s.inlineRewardTitle}>Opened!</Text>
        <Animated.View style={{ transform: [{ scale: revealAnim }] }}>
          <GameCardItem card={reward} size="sm" />
        </Animated.View>
      </View>
    );
  }

  return (
    <TouchableOpacity
      onPress={handleOpen}
      disabled={crate.opened || opening}
      activeOpacity={0.82}
    >
      <Animated.View
        style={[
          s.inlineCrate,
          { borderColor: crate.opened ? Colors.border : cfg.border },
          crate.opened && { opacity: 0.45 },
          { transform: [{ translateX: shakeAnim }] },
        ]}
      >
        <LinearGradient colors={crate.opened ? [Colors.surface, Colors.surfaceElevated] : [cfg.gradStart, cfg.gradEnd]} style={s.inlineCrateInner}>
          <Text style={s.inlineCrateIcon}>{crate.opened ? '📭' : cfg.icon}</Text>
          <View style={s.inlineCrateText}>
            <Text style={s.inlineCrateName}>{cfg.label}</Text>
            <Text style={s.inlineCrateSub}>{crate.opened ? 'Already opened' : cfg.sub}</Text>
          </View>
          {!crate.opened && (
            <View style={[s.inlineCrateBtn, { borderColor: cfg.border + '77' }]}>
              <Text style={[s.inlineCrateBtnText, { color: cfg.border }]}>
                {opening ? '…' : 'Open'}
              </Text>
            </View>
          )}
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
}

const CRATE_CFG: Record<Crate['type'], { icon: string; label: string; sub: string; border: string; gradStart: string; gradEnd: string }> = {
  basic:   { icon: '📦', label: 'Basic Crate',   sub: 'Common–Rare',   border: '#8B7355', gradStart: '#1A1208', gradEnd: '#241A0A' },
  ad:      { icon: '🎁', label: 'Bonus Crate',   sub: 'Rare guaranteed', border: '#3B82F6', gradStart: '#0B1632', gradEnd: '#0F1F44' },
  premium: { icon: '💎', label: 'Premium Crate', sub: 'Epic guaranteed', border: '#A855F7', gradStart: '#1A0B32', gradEnd: '#25124A' },
};

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Hero daily crate card
  heroCard: {
    borderRadius: Radius['2xl'],
    borderWidth:  2,
    overflow:     'hidden',
    alignItems:   'center',
    padding:      Spacing.xl,
    gap:          Spacing.md,
    ...Platform.select({
      ios: { shadowColor: '#C49A3C', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 20 },
      android: { elevation: 8 },
    }),
  },
  heroChestWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  heroGlowRing: {
    position:    'absolute',
    width:       96,
    height:      96,
    borderRadius: 48,
    backgroundColor: '#F59E0B22',
    borderWidth:  1.5,
    borderColor: '#F59E0B44',
  },
  heroChest: {
    width:         80,
    height:        80,
    borderRadius:  Radius['2xl'],
    alignItems:    'center',
    justifyContent: 'center',
    borderWidth:   1.5,
    borderColor:   '#C49A3C44',
  },
  heroChestIcon: { fontSize: 44 },
  heroTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.heavy, letterSpacing: 0.3 },
  heroSubtitle: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: -Spacing.xs },
  heroBtn: {
    backgroundColor: '#C49A3C',
    borderRadius:    Radius.full,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical:   Spacing.md,
    marginTop:       Spacing.xs,
    ...Platform.select({
      ios: { shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.55, shadowRadius: 10 },
      android: { elevation: 6 },
    }),
  },
  heroBtnLoading:  { opacity: 0.55 },
  heroBtnText: { fontSize: FontSize.base, fontWeight: FontWeight.heavy, color: '#0A0A0F', letterSpacing: 1 },

  heroYouGot: { fontSize: FontSize['2xl'], fontWeight: FontWeight.heavy, color: Colors.text },
  rarityBadge: { borderRadius: Radius.full, borderWidth: 1, paddingHorizontal: Spacing.md, paddingVertical: 5 },
  rarityBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.heavy, letterSpacing: 1.2 },
  heroClaimedHint: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },

  // Inline crate (purchased/ad)
  inlineCrate: {
    borderRadius: Radius.xl,
    borderWidth:  1.5,
    overflow:     'hidden',
  },
  inlineCrateInner: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing.md,
    padding:       Spacing.md,
  },
  inlineCrateIcon: { fontSize: 30 },
  inlineCrateText: { flex: 1 },
  inlineCrateName: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.text },
  inlineCrateSub:  { fontSize: FontSize.xs, color: Colors.textMuted },
  inlineCrateBtn: {
    borderWidth:  1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical:   6,
  },
  inlineCrateBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  // Reward reveal
  inlineReward:      { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
  inlineRewardTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.text },
});
