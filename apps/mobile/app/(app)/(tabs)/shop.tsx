import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useGameStore } from '../../../src/store/game.store';
import { DailyCrateCard, CrateOpener } from '../../../src/components/shop/CrateOpener';
import { LuckyWheel } from '../../../src/components/shop/LuckyWheel';
import { DailyPass } from '../../../src/components/shop/DailyPass';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../../src/theme';
import { cardsService } from '../../../src/services/cards.service';
import { isCompetitiveMode } from '../../../src/types';
import type { GameCard } from '../../../src/types';

// ── Multiplayer-only notice ────────────────────────────────────────────────────

function MultiplayerOnlyNotice() {
  return (
    <View style={st.mpNotice}>
      <Text style={st.mpNoticeIcon}>🔒</Text>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={st.mpNoticeTitle}>Multiplayer Only</Text>
        <Text style={st.mpNoticeBody}>
          Card packs and crates are only available in multiplayer mode.
          Join or create a challenge to unlock the full shop.
        </Text>
      </View>
    </View>
  );
}

// ── Store catalog ──────────────────────────────────────────────────────────────

interface CatalogItem {
  id:          string;
  icon:        string;
  name:        string;
  tagline:     string;
  value:       string;
  price:       string;
  cooldown:    string;
  cooldownClr: string;
  border:      string;
  gradStart:   string;
  gradEnd:     string;
}

const TIME_PACKS: CatalogItem[] = [
  {
    id: 'time_sm',
    icon: '⚡', name: 'Quick Boost', tagline: 'One-time time bonus',
    value: '+30 Min', price: '$1.99',
    cooldown: '1× per day', cooldownClr: '#10B981',
    border: '#10B981', gradStart: '#081F14', gradEnd: '#0D2A1B',
  },
  {
    id: 'time_md',
    icon: '⏰', name: 'Power Pack', tagline: 'Large time bonus',
    value: '+2 Hours', price: '$4.99',
    cooldown: '1× per 48 hours', cooldownClr: '#F59E0B',
    border: '#F59E0B', gradStart: '#1F1100', gradEnd: '#2E1900',
  },
  {
    id: 'time_lg',
    icon: '🕰️', name: 'Time Vault', tagline: 'Only available when < 30 min left',
    value: '+6 Hours', price: '$9.99',
    cooldown: '1× per week · Hard cap', cooldownClr: '#E17055',
    border: '#E17055', gradStart: '#200A08', gradEnd: '#2E0F0C',
  },
];

const CARD_PACKS: CatalogItem[] = [
  {
    id: 'cards_sm',
    icon: '🃏', name: 'Starter Pack', tagline: '3 random cards (standard drop rates)',
    value: '3 Cards', price: '$1.99',
    cooldown: '1× per day', cooldownClr: '#9CA3AF',
    border: '#6B7280', gradStart: '#111318', gradEnd: '#191C22',
  },
  {
    id: 'cards_md',
    icon: '🔵', name: 'Rare Pack', tagline: 'Guaranteed Rare or higher',
    value: '3 Rare+', price: '$3.99',
    cooldown: '1× per 3 days', cooldownClr: '#3B82F6',
    border: '#3B82F6', gradStart: '#0B1930', gradEnd: '#111F42',
  },
  {
    id: 'cards_lg',
    icon: '🟣', name: 'Epic Pack', tagline: 'Guaranteed Epic or higher',
    value: '1 Epic+', price: '$7.99',
    cooldown: '1× per week', cooldownClr: '#A855F7',
    border: '#A855F7', gradStart: '#1A0B32', gradEnd: '#25124A',
  },
];


// ── Store row component ────────────────────────────────────────────────────────

function StoreRow({ item }: { item: CatalogItem }) {
  return (
    <LinearGradient
      colors={[item.gradStart, item.gradEnd]}
      style={[st.storeRow, { borderColor: item.border + '55' }]}
    >
      {/* Icon */}
      <View style={[st.storeRowIcon, { backgroundColor: item.border + '18', borderColor: item.border + '44' }]}>
        <Text style={{ fontSize: 26 }}>{item.icon}</Text>
      </View>

      {/* Info */}
      <View style={st.storeRowInfo}>
        <View style={st.storeRowNameRow}>
          <Text style={st.storeRowName}>{item.name}</Text>
          <View style={[st.valuePill, { backgroundColor: item.border + '22', borderColor: item.border + '66' }]}>
            <Text style={[st.valuePillText, { color: item.border }]}>{item.value}</Text>
          </View>
        </View>
        <Text style={st.storeRowTagline}>{item.tagline}</Text>
        <View style={[st.cooldownPill, { backgroundColor: item.cooldownClr + '14' }]}>
          <Text style={[st.cooldownText, { color: item.cooldownClr }]}>🔒 {item.cooldown}</Text>
        </View>
      </View>

      {/* Price */}
      <View style={st.storeRowPrice}>
        <Text style={st.priceText}>{item.price}</Text>
        <View style={st.soonBadge}>
          <Text style={st.soonText}>Soon</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

// ── Shop Section Header ────────────────────────────────────────────────────────

function SectionHeader({ title, note }: { title: string; note: string }) {
  return (
    <View style={st.sectionHeader}>
      <Text style={st.sectionTitle}>{title}</Text>
      <Text style={st.sectionNote}>{note}</Text>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────

type Tab = 'shop' | 'pass' | 'wheel';

export default function ShopScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>('shop');
  const {
    myCrates,
    hasFreeCrateAvailable,
    hasSpunToday,
    setHasSpunToday,
    mode,
  } = useGameStore();
  // Both multiplayer and ranked give access to the full shop
  const inGame = isCompetitiveMode(mode);

  const [claimedCard, setClaimedCard] = useState<GameCard | null>(null);

  // If the user leaves a competitive game while on the Pass tab, redirect to Shop
  useEffect(() => {
    if (!inGame && activeTab === 'pass') {
      setActiveTab('shop');
    }
  }, [inGame]);

  const unopenedCrates = myCrates.filter((c) => !c.opened);

  const handleSpin = async () => {
    const result = await cardsService.spinLuckyWheel();
    return result;
  };

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'shop',  label: 'Shop',  icon: '🛒' },
    ...(inGame ? [{ key: 'pass' as Tab, label: 'Pass', icon: '👑' }] : []),
    { key: 'wheel', label: 'Wheel', icon: '🎡' },
  ];

  return (
    <LinearGradient colors={[Colors.background, '#0D0D1A']} style={st.gradient}>
      <ScrollView
        contentContainerStyle={[st.scroll, { paddingTop: insets.top + Spacing.base }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Page Header ── */}
        <View style={st.pageHeader}>
          <Text style={st.pageTitle}>Shop</Text>
          <View style={st.gemRow}>
            <Text style={st.gemIcon}>💎</Text>
            <Text style={st.gemText}>Purchases coming soon</Text>
          </View>
        </View>

        {/* ── Tab Switcher ── */}
        <View style={st.tabBar}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[st.tab, activeTab === tab.key && st.tabActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.75}
            >
              <Text style={[st.tabIcon, activeTab === tab.key && { opacity: 1 }]}>{tab.icon}</Text>
              <Text style={[st.tabLabel, activeTab === tab.key && st.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ════════════════════════════════ SHOP TAB ═══════════════════════════ */}
        {activeTab === 'shop' && (
          <View style={st.content}>

            {/* Daily free crate hero — multiplayer only */}
            {inGame && (
              <DailyCrateCard
                available={hasFreeCrateAvailable}
                onClaimed={setClaimedCard}
                onUnavailable={() => {}}
              />
            )}

            {/* Bought / ad crates that aren't opened yet — multiplayer only */}
            {inGame && unopenedCrates.length > 0 && (
              <View style={st.section}>
                <Text style={st.listLabel}>Your Crates</Text>
                {unopenedCrates.map((c) => (
                  <CrateOpener key={c.id} crate={c} />
                ))}
              </View>
            )}

            {/* ── Time Packs ── always visible ── */}
            <View style={st.section}>
              <SectionHeader
                title="⏰  Time Boosts"
                note="Daily purchased time capped at +60 min to keep things fair"
              />
              {TIME_PACKS.map((item) => <StoreRow key={item.id} item={item} />)}
            </View>

            {/* ── Card Packs — multiplayer only ── */}
            {inGame ? (
              <View style={st.section}>
                <SectionHeader
                  title="🃏  Card Packs"
                  note="Maximum 6 card packs per week across all tiers"
                />
                {CARD_PACKS.map((item) => <StoreRow key={item.id} item={item} />)}
              </View>
            ) : (
              <MultiplayerOnlyNotice />
            )}

          </View>
        )}

        {/* ════════════════════════════════ PASS TAB ═══════════════════════════ */}
        {activeTab === 'pass' && (
          <View style={st.content}>
            <DailyPass />
          </View>
        )}

        {/* ════════════════════════════════ WHEEL TAB ══════════════════════════ */}
        {activeTab === 'wheel' && (
          <View style={st.content}>

            {/* Header info */}
            <View style={st.wheelInfo}>
              <Text style={st.wheelInfoTitle}>🎡  Lucky Wheel</Text>
              <Text style={st.wheelInfoBody}>
                {inGame
                  ? 'One spin per day, available by watching a short ad. Win time, crates, cards, or an extra spin.'
                  : 'One spin per day, available by watching a short ad. Win bonus screen time instantly.'}
              </Text>
              <View style={st.wheelInfoBadges}>
                <View style={[st.badge, { borderColor: '#C49A3C55', backgroundColor: '#C49A3C14' }]}>
                  <Text style={[st.badgeText, { color: '#FCD34D' }]}>1× / day</Text>
                </View>
                <View style={[st.badge, { borderColor: '#10B98155', backgroundColor: '#10B98114' }]}>
                  <Text style={[st.badgeText, { color: '#10B981' }]}>Free · Watch Ad</Text>
                </View>
                {!inGame && (
                  <View style={[st.badge, { borderColor: '#6B728055', backgroundColor: '#6B728014' }]}>
                    <Text style={[st.badgeText, { color: Colors.textMuted }]}>Time prizes only</Text>
                  </View>
                )}
              </View>
            </View>

            <LuckyWheel
              onSpin={handleSpin}
              hasSpunToday={hasSpunToday}
              onSpunToday={() => setHasSpunToday(true)}
              soloMode={!inGame}
            />

          </View>
        )}

        <View style={{ height: Spacing['3xl'] }} />
      </ScrollView>
    </LinearGradient>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  gradient: { flex: 1 },
  scroll:   { padding: Spacing.base, gap: Spacing.base },

  pageHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  pageTitle: { fontSize: FontSize['2xl'], fontWeight: FontWeight.heavy, color: Colors.text },
  gemRow:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  gemIcon:   { fontSize: 14 },
  gemText:   { fontSize: FontSize.xs, color: Colors.textMuted },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.xl,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: Spacing.sm, borderRadius: Radius.lg,
  },
  tabActive: { backgroundColor: Colors.primary + '2A' },
  tabIcon:   { fontSize: 16, opacity: 0.6 },
  tabLabel:  { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: FontWeight.medium },
  tabLabelActive: { color: Colors.primaryLight, fontWeight: FontWeight.semibold },

  content: { gap: Spacing.lg },
  section: { gap: Spacing.sm },
  listLabel: {
    fontSize: FontSize.xs, fontWeight: FontWeight.heavy,
    color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.2,
  },

  sectionHeader:  { gap: 3 },
  sectionTitle:   { fontSize: FontSize.base, fontWeight: FontWeight.heavy, color: Colors.text },
  sectionNote:    { fontSize: FontSize.xs, color: Colors.textMuted, lineHeight: 16 },

  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    padding: Spacing.md,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 6 },
      android: { elevation: 3 },
    }),
  },
  storeRowIcon: {
    width: 50, height: 50,
    borderRadius: Radius.lg,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  storeRowInfo:    { flex: 1, gap: 4 },
  storeRowNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  storeRowName:    { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.text },
  valuePill: {
    borderRadius: Radius.full, borderWidth: 1,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  valuePillText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  storeRowTagline: { fontSize: FontSize.xs, color: Colors.textMuted, lineHeight: 16 },
  cooldownPill: {
    borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start',
  },
  cooldownText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },

  storeRowPrice: { alignItems: 'flex-end', gap: 4, minWidth: 54 },
  priceText:     { fontSize: FontSize.base, fontWeight: FontWeight.heavy, color: Colors.text },
  soonBadge: {
    backgroundColor: Colors.warning + '22',
    borderRadius: Radius.full,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  soonText: { fontSize: FontSize.xs, color: Colors.warning, fontWeight: FontWeight.semibold },

  mpNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.base,
  },
  mpNoticeIcon:  { fontSize: 22, marginTop: 1 },
  mpNoticeTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.text },
  mpNoticeBody:  { fontSize: FontSize.xs, color: Colors.textMuted, lineHeight: 17 },

  // Wheel tab
  wheelInfo: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.base,
    gap: Spacing.sm,
  },
  wheelInfoTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.heavy, color: Colors.text },
  wheelInfoBody:  { fontSize: FontSize.sm, color: Colors.textMuted, lineHeight: 20 },
  wheelInfoBadges: { flexDirection: 'row', gap: Spacing.sm },
  badge: {
    borderWidth: 1, borderRadius: Radius.full,
    paddingHorizontal: Spacing.md, paddingVertical: 5,
  },
  badgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
});
