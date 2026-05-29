import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CARD_NAMES, CARD_VAL_LABELS, CARD_VALUES } from '../../constants';
import type { GameCard, Rarity, GameCardType } from '../../types';

// ── Design tokens per rarity ──────────────────────────────────────────────────

type RarityTokens = {
  border:    string;
  headerBg:  string;
  gradStart: string;
  gradEnd:   string;
  valClr:    string;
  starClr:   string;
  stars:     string;
  glow:      string;
  nameStrip: string;
};

const RARITY_TOKENS: Record<Rarity, RarityTokens> = {
  common: {
    border:    '#5B6370',
    headerBg:  '#374151',
    gradStart: '#1A1D25',
    gradEnd:   '#252833',
    valClr:    '#9CA3AF',
    starClr:   '#9CA3AF',
    stars:     '★',
    glow:      'transparent',
    nameStrip: '#1E2028',
  },
  rare: {
    border:    '#3B82F6',
    headerBg:  '#1D4ED8',
    gradStart: '#0B1930',
    gradEnd:   '#111F42',
    valClr:    '#60A5FA',
    starClr:   '#93C5FD',
    stars:     '★★',
    glow:      'rgba(59,130,246,0.22)',
    nameStrip: '#0F1729',
  },
  epic: {
    border:    '#A855F7',
    headerBg:  '#7C3AED',
    gradStart: '#1A0B32',
    gradEnd:   '#25124A',
    valClr:    '#C084FC',
    starClr:   '#D8B4FE',
    stars:     '★★★',
    glow:      'rgba(168,85,247,0.25)',
    nameStrip: '#170930',
  },
  legendary: {
    border:    '#F59E0B',
    headerBg:  '#92400E',
    gradStart: '#1F1100',
    gradEnd:   '#2E1900',
    valClr:    '#FCD34D',
    starClr:   '#FDE68A',
    stars:     '★★★★',
    glow:      'rgba(245,158,11,0.30)',
    nameStrip: '#1C1000',
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

function formatCardValue(type: GameCardType, rarity: Rarity): string {
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
    default:                         return String(v);
  }
}

// ── Card sizes ─────────────────────────────────────────────────────────────────
// sm  = 96 × ~148  — tight grid (3 per row on 375px screen)
// md  = 112 × ~172 — standard
// lg  = 140 × ~215 — hero / crate reward reveal

const SIZES = {
  sm: { width: 96,  artH: 62,  icon: 30, nameFz: 9,  valFz: 13, hdrH: 21 },
  md: { width: 112, artH: 74,  icon: 36, nameFz: 10, valFz: 15, hdrH: 24 },
  lg: { width: 140, artH: 96,  icon: 48, nameFz: 12, valFz: 18, hdrH: 28 },
} as const;

// ── Props ──────────────────────────────────────────────────────────────────────

interface GameCardItemProps {
  card:     GameCard;
  onPress?: (card: GameCard) => void;
  isUsed?:  boolean;
  style?:   ViewStyle;
  size?:    'sm' | 'md' | 'lg';
}

// ── Component ──────────────────────────────────────────────────────────────────

export function GameCardItem({
  card,
  onPress,
  isUsed,
  style,
  size = 'md',
}: GameCardItemProps) {
  const tk   = RARITY_TOKENS[card.rarity];
  const sz   = SIZES[size];
  const icon = CARD_ICONS[card.type] ?? '🎴';
  const name = CARD_NAMES[card.type] ?? card.type;
  const val  = formatCardValue(card.type, card.rarity);
  const lbl  = CARD_VAL_LABELS[card.type] ?? '';

  const inner = (
    <View style={[styles.card, { width: sz.width, borderColor: tk.border }, style]}>
      {/* Rarity header */}
      <View style={[styles.header, { backgroundColor: tk.headerBg, height: sz.hdrH }]}>
        <Text style={styles.rarityText} numberOfLines={1}>
          {card.rarity.toUpperCase()}
        </Text>
        <Text style={[styles.stars, { color: tk.starClr }]}>{tk.stars}</Text>
      </View>

      {/* Art zone */}
      <LinearGradient
        colors={[tk.gradStart, tk.gradEnd]}
        style={[styles.art, { height: sz.artH }]}
      >
        <Text style={{ fontSize: sz.icon }}>{icon}</Text>
      </LinearGradient>

      {/* Name strip */}
      <View style={[styles.nameStrip, { backgroundColor: tk.nameStrip }]}>
        <Text style={[styles.name, { fontSize: sz.nameFz }]} numberOfLines={2}>
          {name.toUpperCase()}
        </Text>
      </View>

      {/* Value footer */}
      <View style={[styles.valRow, { borderTopColor: tk.border + '44', backgroundColor: '#0A0A0F' }]}>
        <Text style={[styles.valNum, { color: tk.valClr, fontSize: sz.valFz }]}>
          {val}
        </Text>
        <Text style={styles.valLbl}>{lbl}</Text>
      </View>

      {/* Used overlay */}
      {isUsed && (
        <View style={styles.usedOverlay}>
          <Text style={styles.usedText}>USED</Text>
        </View>
      )}
    </View>
  );

  if (!onPress) return inner;

  return (
    <TouchableOpacity
      onPress={() => !isUsed && onPress(card)}
      activeOpacity={0.85}
      disabled={!!isUsed}
      style={[
        { borderRadius: 10 },
        tk.glow !== 'transparent' && {
          ...Platform.select({
            ios: {
              shadowColor: tk.border,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.55,
              shadowRadius: 8,
            },
            android: { elevation: 6 },
          }),
        },
      ]}
    >
      {inner}
    </TouchableOpacity>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius:   10,
    overflow:       'hidden',
    borderWidth:    2,
    backgroundColor: '#0A0A0F',
  },

  header: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    paddingHorizontal: 7,
  },
  rarityText: {
    fontSize:    8,
    fontWeight:  '800',
    color:       '#FFFFFFCC',
    letterSpacing: 1,
  },
  stars: {
    fontSize:    8,
    letterSpacing: 1.5,
    fontWeight: '700',
  },

  art: {
    alignItems:      'center',
    justifyContent:  'center',
  },

  nameStrip: {
    paddingHorizontal: 7,
    paddingVertical:   5,
    minHeight:         26,
    justifyContent:    'center',
  },
  name: {
    fontWeight:    '800',
    color:         '#F1F5F9',
    letterSpacing: 0.4,
    lineHeight:    13,
  },

  valRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'baseline',
    paddingHorizontal: 7,
    paddingVertical: 6,
    borderTopWidth:  1,
  },
  valNum: {
    fontWeight:    '800',
    letterSpacing: 0.2,
  },
  valLbl: {
    fontSize:    8,
    color:       '#475569',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  usedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.60)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  usedText: {
    fontSize:    14,
    fontWeight:  '800',
    color:       '#4B5563',
    letterSpacing: 3,
  },
});
