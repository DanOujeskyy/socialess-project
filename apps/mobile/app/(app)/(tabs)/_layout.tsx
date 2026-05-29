import { Tabs } from 'expo-router';
import { View, StyleSheet, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../../src/theme';
import { useGameStore } from '../../../src/store/game.store';
import { isCompetitiveMode } from '../../../src/types';
import type { GameCard } from '../../../src/types';

// ── Tab icon ───────────────────────────────────────────────────────────────────

function TabIcon({ icon, focused, badge }: { icon: string; focused: boolean; badge?: boolean }) {
  return (
    <View style={[styles.tabIcon, focused && styles.tabIconFocused]}>
      <Text style={[styles.tabEmoji, { opacity: focused ? 1 : 0.55 }]}>{icon}</Text>
      {badge && <View style={styles.badgeDot} />}
    </View>
  );
}

// ── Card Overflow Modal ────────────────────────────────────────────────────────
// Appears when the player receives a 7th card; they must discard one to proceed.

function CardOverflowModal({
  overflow,
  held,
  onResolve,
}: {
  overflow: GameCard;
  held: GameCard[];
  onResolve: (discardId: string) => void;
}) {
  const RARITY_COLOR: Record<string, string> = {
    common: '#6B7280', rare: '#3B82F6', epic: '#A855F7', legendary: '#F59E0B',
  };
  const CARD_NAMES: Record<string, string> = {
    nerf_activities: 'Nerf Activities', buff_activities: 'Buff Activities',
    ban_activity: 'Ban Activity', limit_time_capacity: 'Limit Capacity',
    reduce_time: 'Reduce Time', increase_time: 'Increase Time',
    reduce_time_frequently: 'Drain Hourly', increase_time_frequently: 'Boost Hourly',
  };

  const renderCard = (card: GameCard, label: string) => (
    <View key={card.id} style={[ovStyles.card, { borderColor: RARITY_COLOR[card.rarity] + '88' }]}>
      <View style={ovStyles.cardHeader}>
        <Text style={[ovStyles.cardRarity, { color: RARITY_COLOR[card.rarity] }]}>
          {card.rarity.toUpperCase()}
        </Text>
        <Text style={ovStyles.cardLabel}>{label}</Text>
      </View>
      <Text style={ovStyles.cardName}>{CARD_NAMES[card.type] ?? card.type}</Text>
      <TouchableOpacity
        style={[ovStyles.discardBtn, { borderColor: RARITY_COLOR[card.rarity] + '55' }]}
        onPress={() => onResolve(card.id)}
        activeOpacity={0.8}
      >
        <Text style={[ovStyles.discardText, { color: RARITY_COLOR[card.rarity] }]}>Discard & Keep New</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal transparent animationType="fade" visible>
      <View style={ovStyles.overlay}>
        <View style={ovStyles.sheet}>
          <Text style={ovStyles.title}>🃏 Card Slots Full</Text>
          <Text style={ovStyles.subtitle}>
            You have 6 cards. Discard one to receive the new card:
          </Text>

          {/* New card preview */}
          <View style={[ovStyles.newCard, { borderColor: RARITY_COLOR[overflow.rarity] + 'AA' }]}>
            <Text style={[ovStyles.newCardBadge, { color: RARITY_COLOR[overflow.rarity] }]}>NEW CARD</Text>
            <Text style={ovStyles.newCardName}>{CARD_NAMES[overflow.type] ?? overflow.type}</Text>
            <Text style={[ovStyles.newCardRarity, { color: RARITY_COLOR[overflow.rarity] }]}>
              {overflow.rarity.toUpperCase()}
            </Text>
          </View>

          <Text style={ovStyles.chooseLabel}>Choose a card to discard:</Text>
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 280 }}>
            {held.map((card) => renderCard(card, 'Discard this'))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const ovStyles = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, gap: Spacing.md },
  title:      { fontSize: FontSize['2xl'], fontWeight: FontWeight.heavy, color: Colors.text, textAlign: 'center' },
  subtitle:   { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },
  newCard: {
    borderRadius: Radius.xl, borderWidth: 1.5,
    padding: Spacing.md, alignItems: 'center', gap: 4,
    backgroundColor: Colors.surfaceElevated,
  },
  newCardBadge: { fontSize: FontSize.xs, fontWeight: FontWeight.heavy, letterSpacing: 1 },
  newCardName:  { fontSize: FontSize.lg, fontWeight: FontWeight.heavy, color: Colors.text },
  newCardRarity: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  chooseLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.heavy, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  card: {
    borderRadius: Radius.lg, borderWidth: 1,
    padding: Spacing.md, gap: Spacing.xs,
    backgroundColor: Colors.surfaceElevated, marginBottom: Spacing.sm,
  },
  cardHeader:  { flexDirection: 'row', justifyContent: 'space-between' },
  cardRarity:  { fontSize: FontSize.xs, fontWeight: FontWeight.heavy },
  cardLabel:   { fontSize: FontSize.xs, color: Colors.textMuted },
  cardName:    { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.text },
  discardBtn:  { borderRadius: Radius.md, borderWidth: 1, paddingVertical: 6, alignItems: 'center', marginTop: 4 },
  discardText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
});

// ── Tab Layout ─────────────────────────────────────────────────────────────────

export default function TabLayout() {
  const insets   = useSafeAreaInsets();
  const mode     = useGameStore((s) => s.mode);
  const myCrates = useGameStore((s) => s.myCrates);
  const cardOverflow    = useGameStore((s) => s.cardOverflow);
  const myCards         = useGameStore((s) => s.myCards);
  const resolveOverflow = useGameStore((s) => s.resolveCardOverflow);

  const inGame      = isCompetitiveMode(mode);
  const shopBadge   = myCrates.some((c) => !c.opened);

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: Colors.surface,
            borderTopColor: Colors.border,
            borderTopWidth: 1,
            height: 60 + insets.bottom,
            paddingBottom: insets.bottom,
          },
          tabBarActiveTintColor:   Colors.primary,
          tabBarInactiveTintColor: Colors.textMuted,
          tabBarLabelStyle: { fontSize: FontSize.xs, marginBottom: 4 },
        }}
      >
        <Tabs.Screen
          name="shop"
          options={{
            title: 'Shop',
            tabBarIcon: ({ focused }) => <TabIcon icon="🛒" focused={focused} badge={shopBadge} />,
          }}
        />

        <Tabs.Screen
          name="cards"
          options={{
            href:  inGame ? undefined : null,
            title: 'Cards',
            tabBarIcon: ({ focused }) => <TabIcon icon="🃏" focused={focused} />,
          }}
        />

        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ focused }) => <TabIcon icon="🏠" focused={focused} />,
          }}
        />

        <Tabs.Screen
          name="players"
          options={{
            href:  inGame ? undefined : null,
            title: 'Players',
            tabBarIcon: ({ focused }) => <TabIcon icon="👥" focused={focused} />,
          }}
        />

        <Tabs.Screen
          name="stats"
          options={{
            title: 'Stats',
            tabBarIcon: ({ focused }) => <TabIcon icon="📊" focused={focused} />,
          }}
        />

        {/* Leaderboard is a standalone modal screen, not a tab */}
      </Tabs>

      {/* Card overflow modal — shows when player receives a 7th card */}
      {cardOverflow && (
        <CardOverflowModal
          overflow={cardOverflow}
          held={myCards}
          onResolve={resolveOverflow}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    width: 32, height: 32,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 10,
  },
  tabIconFocused: { backgroundColor: Colors.primary + '22' },
  tabEmoji: { fontSize: 20 },
  badgeDot: {
    position: 'absolute', top: 0, right: 0,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.danger,
    borderWidth: 1.5, borderColor: Colors.surface,
  },
});
