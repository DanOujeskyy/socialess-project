import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { formatDistanceToNow } from 'date-fns';
import { CARD_NAMES, EVENT_CARD_DESCRIPTIONS, CARD_VAL_LABELS, CARD_VALUES } from '../../constants';
import type { EventCard, Rarity, EventCardType } from '../../types';

// ── Shared rarity tokens (must match GameCardItem) ────────────────────────────

const RARITY_TOKENS: Record<Rarity, {
  border: string; headerBg: string; gradStart: string; gradEnd: string;
  valClr: string; starClr: string; stars: string; nameStrip: string;
}> = {
  common: {
    border: '#5B6370', headerBg: '#374151', gradStart: '#1A1D25', gradEnd: '#252833',
    valClr: '#9CA3AF', starClr: '#9CA3AF', stars: '★', nameStrip: '#1E2028',
  },
  rare: {
    border: '#3B82F6', headerBg: '#1D4ED8', gradStart: '#0B1930', gradEnd: '#111F42',
    valClr: '#60A5FA', starClr: '#93C5FD', stars: '★★', nameStrip: '#0F1729',
  },
  epic: {
    border: '#A855F7', headerBg: '#7C3AED', gradStart: '#1A0B32', gradEnd: '#25124A',
    valClr: '#C084FC', starClr: '#D8B4FE', stars: '★★★', nameStrip: '#170930',
  },
  legendary: {
    border: '#F59E0B', headerBg: '#92400E', gradStart: '#1F1100', gradEnd: '#2E1900',
    valClr: '#FCD34D', starClr: '#FDE68A', stars: '★★★★', nameStrip: '#1C1000',
  },
};

const CARD_ICONS: Record<string, string> = {
  nerf_activities:          '📉',
  buff_activities:          '📈',
  ban_activity:             '🚫',
  limit_time_capacity:      '🔒',
  reduce_time:              '⏳',
  increase_time:            '⏰',
  reduce_time_frequently:   '🔻',
  increase_time_frequently: '🔺',
  more_game_cards:          '🃏',
};

function formatCardValue(type: EventCardType, rarity: Rarity): string {
  const v = CARD_VALUES[type]?.[rarity];
  if (v === undefined) return '—';
  switch (type) {
    case 'ban_activity':             return `${v}h`;
    case 'nerf_activities':          return `−${v}%`;
    case 'buff_activities':          return `+${v}%`;
    case 'limit_time_capacity':      return `−${v}%`;
    case 'reduce_time':              return `−${v}m`;
    case 'increase_time':            return `+${v}m`;
    case 'reduce_time_frequently':   return `−${v}/h`;
    case 'increase_time_frequently': return `+${v}/h`;
    case 'more_game_cards':          return `×${v}`;
    default:                         return String(v);
  }
}

// ── Component ──────────────────────────────────────────────────────────────────

interface EventCardItemProps {
  card: EventCard;
}

export function EventCardItem({ card }: EventCardItemProps) {
  const tk   = RARITY_TOKENS[card.rarity];
  const icon = CARD_ICONS[card.type] ?? '🎴';
  const name = CARD_NAMES[card.type] ?? card.type;
  const val  = formatCardValue(card.type, card.rarity);
  const lbl  = CARD_VAL_LABELS[card.type] ?? '';
  const desc = EVENT_CARD_DESCRIPTIONS[card.type] ?? '';

  const expiryLabel = card.activeUntil
    ? `Expires ${formatDistanceToNow(new Date(card.activeUntil), { addSuffix: true })}`
    : 'Active today';

  return (
    <View style={[styles.card, { borderColor: tk.border }]}>
      {/* Header: rarity + EVENT badge + stars */}
      <View style={[styles.header, { backgroundColor: tk.headerBg }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.rarityText}>{card.rarity.toUpperCase()}</Text>
          <View style={styles.eventPill}>
            <Text style={styles.eventPillText}>EVENT</Text>
          </View>
        </View>
        <Text style={[styles.stars, { color: tk.starClr }]}>{tk.stars}</Text>
      </View>

      {/* Body row: art + info */}
      <LinearGradient colors={[tk.gradStart, tk.gradEnd]} style={styles.body}>
        {/* Art */}
        <View style={styles.artCol}>
          <Text style={styles.artIcon}>{icon}</Text>
        </View>

        {/* Info */}
        <View style={styles.infoCol}>
          <Text style={styles.name}>{name.toUpperCase()}</Text>
          <Text style={styles.desc} numberOfLines={3}>{desc}</Text>
          <View style={styles.valRow}>
            <Text style={[styles.val, { color: tk.valClr }]}>{val}</Text>
            <Text style={styles.valLbl}>{lbl}</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Footer: active status + expiry */}
      <View style={[styles.footer, { borderTopColor: tk.border + '44', backgroundColor: tk.nameStrip }]}>
        <View style={[styles.activeDot, { backgroundColor: card.isActive ? '#10B981' : '#6B7280' }]} />
        <Text style={styles.footerText}>{card.isActive ? 'Active' : 'Expired'}</Text>
        <Text style={styles.expiryText}>{expiryLabel}</Text>
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius:    12,
    overflow:        'hidden',
    borderWidth:     2,
    backgroundColor: '#0A0A0F',
  },

  header: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    paddingHorizontal: 12,
    paddingVertical:   8,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rarityText: { fontSize: 10, fontWeight: '800', color: '#FFFFFFCC', letterSpacing: 1 },
  eventPill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  eventPillText: { fontSize: 9, fontWeight: '800', color: '#FFF', letterSpacing: 1.5 },
  stars: { fontSize: 10, letterSpacing: 2, fontWeight: '700' },

  body: {
    flexDirection: 'row',
    padding: 14,
    gap: 14,
  },
  artCol: {
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    padding: 10,
  },
  artIcon: { fontSize: 38 },

  infoCol: { flex: 1, gap: 6, justifyContent: 'center' },
  name: { fontSize: 13, fontWeight: '800', color: '#F1F5F9', letterSpacing: 0.5, lineHeight: 16 },
  desc: { fontSize: 11, color: '#94A3B8', lineHeight: 16 },
  valRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  val: { fontSize: 17, fontWeight: '800', letterSpacing: 0.2 },
  valLbl: { fontSize: 9, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 },

  footer: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingHorizontal: 12,
    paddingVertical:   8,
    borderTopWidth:    1,
    gap:               6,
  },
  activeDot:   { width: 7, height: 7, borderRadius: 3.5 },
  footerText:  { fontSize: 10, fontWeight: '700', color: '#94A3B8' },
  expiryText:  { fontSize: 10, color: '#475569', marginLeft: 'auto' },
});
