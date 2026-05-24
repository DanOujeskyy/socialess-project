import { Platform } from 'react-native';

export const Colors = {
  background:       '#0A0A0F',
  surface:          '#141420',
  surfaceElevated:  '#1E1E2E',
  surfaceHighlight: '#252535',
  border:           '#2A2A3E',

  primary:      '#6C5CE7',
  primaryLight: '#8B7FF0',
  primaryDark:  '#4F3CC9',

  secondary:     '#00CEC9',
  secondaryLight:'#2DFBF5',

  accent: '#FD79A8',

  warning: '#FDCB6E',
  danger:  '#E17055',
  success: '#55EFC4',
  info:    '#74B9FF',

  text:         '#FFFFFF',
  textSecondary:'#B2BEC3',
  textMuted:    '#636E72',
  textDisabled: '#3D3D5C',

  rarity: {
    common:    '#9CA3AF',
    rare:      '#3B82F6',
    epic:      '#A855F7',
    legendary: '#F59E0B',
  },

  rarityGlow: {
    common:    'rgba(156, 163, 175, 0.15)',
    rare:      'rgba(59, 130, 246, 0.25)',
    epic:      'rgba(168, 85, 247, 0.30)',
    legendary: 'rgba(245, 158, 11, 0.35)',
  },

  rarityGradient: {
    common:    ['#1E1E2E', '#252535'],
    rare:      ['#1a2540', '#1E2D4A'],
    epic:      ['#2A1A40', '#321E4D'],
    legendary: ['#3A2A0A', '#4A3210'],
  },

  overlay:      'rgba(0, 0, 0, 0.75)',
  overlayLight: 'rgba(0, 0, 0, 0.45)',
  transparent:  'transparent',
} as const;

export const FontSize = {
  xs:   10,
  sm:   12,
  md:   14,
  base: 16,
  lg:   18,
  xl:   20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 32,
  '5xl': 40,
} as const;

export const FontWeight = {
  regular: '400' as const,
  medium:  '500' as const,
  semibold:'600' as const,
  bold:    '700' as const,
  heavy:   '800' as const,
};

export const Spacing = {
  xs:   4,
  sm:   8,
  md:   12,
  base: 16,
  lg:   20,
  xl:   24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
} as const;

export const Radius = {
  sm:   6,
  md:   10,
  lg:   14,
  xl:   18,
  '2xl': 24,
  full: 9999,
} as const;

export const Shadow = {
  sm: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.30, shadowRadius: 3 },
    android: { elevation: 2 },
    default: {},
  }),
  md: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.40, shadowRadius: 8 },
    android: { elevation: 5 },
    default: {},
  }),
  lg: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.50, shadowRadius: 16 },
    android: { elevation: 10 },
    default: {},
  }),
  primary: Platform.select({
    ios: { shadowColor: '#6C5CE7', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 12 },
    android: { elevation: 8 },
    default: {},
  }),
} as const;

export type RarityKey = 'common' | 'rare' | 'epic' | 'legendary';
