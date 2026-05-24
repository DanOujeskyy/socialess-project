import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useGameStore } from '../../../src/store/game.store';
import { CrateOpener } from '../../../src/components/shop/CrateOpener';
import { LuckyWheel } from '../../../src/components/shop/LuckyWheel';
import { Card } from '../../../src/components/ui/Card';
import { Button } from '../../../src/components/ui/Button';
import { Modal } from '../../../src/components/ui/Modal';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../../src/theme';
import { cardsService } from '../../../src/services/cards.service';
import type { GameCard, Crate } from '../../../src/types';

type ShopTab = 'crates' | 'wheel' | 'store';

export default function ShopScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<ShopTab>('crates');
  const {
    myCrates,
    hasAdCrateAvailable,
    hasSpunToday,
    hasAdSpinAvailable,
    setHasAdCrateAvailable,
    setHasSpunToday,
    setHasAdSpinAvailable,
    addCrate,
  } = useGameStore();

  const [crateReward, setCrateReward] = useState<GameCard | null>(null);

  const handleAdCrate = async () => {
    // In production, show rewarded ad first, then call API
    Alert.alert(
      'Watch Ad',
      'Watch a short ad to earn a free crate?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Watch Ad',
          onPress: async () => {
            try {
              const crate = await cardsService.claimAdCrate();
              addCrate(crate);
              setHasAdCrateAvailable(false);
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.message ?? 'Could not claim crate');
            }
          },
        },
      ],
    );
  };

  const handleAdSpin = async () => {
    try {
      const result = await cardsService.claimAdSpin();
      if (result.canSpin) setHasAdSpinAvailable(true);
    } catch {}
  };

  const handleSpin = async () => {
    const result = await cardsService.spinLuckyWheel();
    setHasSpunToday(true);
    setHasAdSpinAvailable(false);
    return result;
  };

  const unopenedCrates = myCrates.filter((c) => !c.opened);
  const openedCrates   = myCrates.filter((c) => c.opened);

  const TABS: { key: ShopTab; label: string; icon: string }[] = [
    { key: 'crates', label: 'Crates',  icon: '📦' },
    { key: 'wheel',  label: 'Wheel',   icon: '🎡' },
    { key: 'store',  label: 'Store',   icon: '💎' },
  ];

  return (
    <LinearGradient colors={[Colors.background, '#0D0D1A']} style={styles.gradient}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + Spacing.base }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Shop</Text>

        {/* Tab Bar */}
        <View style={styles.tabBar}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={styles.tabIcon}>{tab.icon}</Text>
              <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Crates Tab */}
        {activeTab === 'crates' && (
          <View style={styles.tabContent}>
            {hasAdCrateAvailable && (
              <Card style={styles.adCard}>
                <View style={styles.adRow}>
                  <Text style={styles.adIcon}>📺</Text>
                  <View style={styles.adInfo}>
                    <Text style={styles.adTitle}>Free Ad Crate</Text>
                    <Text style={styles.adDesc}>Watch 1 ad to earn a free crate</Text>
                  </View>
                  <Button label="Watch" variant="secondary" size="sm" onPress={handleAdCrate} />
                </View>
              </Card>
            )}

            {unopenedCrates.length === 0 && !hasAdCrateAvailable ? (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>📦</Text>
                <Text style={styles.emptyText}>No crates available. Come back tomorrow!</Text>
                <Text style={styles.emptyHint}>You receive 1 free crate every day.</Text>
              </View>
            ) : (
              <View style={styles.crateGrid}>
                {unopenedCrates.map((crate) => (
                  <CrateOpener key={crate.id} crate={crate} onOpened={setCrateReward} />
                ))}
              </View>
            )}

            {openedCrates.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Opened Today</Text>
                <View style={styles.crateGrid}>
                  {openedCrates.slice(0, 4).map((crate) => (
                    <CrateOpener key={crate.id} crate={crate} />
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* Lucky Wheel Tab */}
        {activeTab === 'wheel' && (
          <View style={styles.tabContent}>
            <Text style={styles.wheelDesc}>
              Spin once a day for free! Watch an ad for an extra spin.
            </Text>
            <LuckyWheel
              onSpin={handleSpin}
              canSpin={!hasSpunToday || hasAdSpinAvailable}
            />
            {hasSpunToday && !hasAdSpinAvailable && (
              <Button
                label="📺 Watch Ad for Extra Spin"
                variant="outline"
                onPress={handleAdSpin}
                style={styles.adSpinBtn}
              />
            )}
          </View>
        )}

        {/* Store Tab */}
        {activeTab === 'store' && (
          <View style={styles.tabContent}>
            <Card style={styles.comingSoon}>
              <Text style={styles.comingSoonIcon}>🚧</Text>
              <Text style={styles.comingSoonTitle}>Store Coming Soon</Text>
              <Text style={styles.comingSoonDesc}>
                Purchase extra time, premium crates, and legendary cards. Fair limits
                ensure it's never pay-to-win.
              </Text>
            </Card>

            {/* Preview items */}
            {[
              { icon: '⏰', name: '+30 Minutes',  desc: 'One-time time boost',      price: '$0.99', limit: '3x/day' },
              { icon: '📦', name: 'Premium Crate',desc: 'Higher legendary chance',   price: '$1.99', limit: '1x/day' },
              { icon: '🃏', name: 'Epic Card',    desc: 'Choose any epic card',      price: '$2.99', limit: '1x/week' },
            ].map((item) => (
              <View key={item.name} style={styles.storeItem}>
                <Text style={styles.storeItemIcon}>{item.icon}</Text>
                <View style={styles.storeItemInfo}>
                  <Text style={styles.storeItemName}>{item.name}</Text>
                  <Text style={styles.storeItemDesc}>{item.desc}</Text>
                  <Text style={styles.storeItemLimit}>{item.limit}</Text>
                </View>
                <View style={styles.storeItemPrice}>
                  <Text style={styles.priceText}>{item.price}</Text>
                  <Text style={styles.comingSoonChip}>Soon</Text>
                </View>
              </View>
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
  scroll: { padding: Spacing.base, gap: Spacing.base },
  title: { fontSize: FontSize['2xl'], fontWeight: FontWeight.heavy, color: Colors.text },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.xl,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  tabActive: { backgroundColor: Colors.primary + '33' },
  tabIcon: { fontSize: 16 },
  tabLabel: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: FontWeight.medium },
  tabLabelActive: { color: Colors.primaryLight },
  tabContent: { gap: Spacing.base },
  adCard: { padding: Spacing.md },
  adRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  adIcon: { fontSize: 28 },
  adInfo: { flex: 1 },
  adTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.text },
  adDesc: { fontSize: FontSize.sm, color: Colors.textMuted },
  empty: { alignItems: 'center', paddingVertical: Spacing['4xl'], gap: Spacing.sm },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'center' },
  emptyHint: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },
  crateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, justifyContent: 'center' },
  section: { gap: Spacing.sm },
  sectionLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  wheelDesc: { fontSize: FontSize.base, color: Colors.textMuted, textAlign: 'center' },
  adSpinBtn: { marginTop: Spacing.md },
  comingSoon: { alignItems: 'center', padding: Spacing.xl, gap: Spacing.sm },
  comingSoonIcon: { fontSize: 40 },
  comingSoonTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text },
  comingSoonDesc: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  storeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
    opacity: 0.6,
  },
  storeItemIcon: { fontSize: 28 },
  storeItemInfo: { flex: 1 },
  storeItemName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.text },
  storeItemDesc: { fontSize: FontSize.sm, color: Colors.textMuted },
  storeItemLimit: { fontSize: FontSize.xs, color: Colors.textDisabled, marginTop: 2 },
  storeItemPrice: { alignItems: 'center', gap: 4 },
  priceText: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.text },
  comingSoonChip: {
    backgroundColor: Colors.warning + '22',
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: FontSize.xs,
    color: Colors.warning,
    fontWeight: FontWeight.semibold,
    overflow: 'hidden',
  },
});
