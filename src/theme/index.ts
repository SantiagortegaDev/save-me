// SaveMe design tokens. Neo-brutalist: flat fills, thick ink borders, hard offset shadows.

export const colors = {
  primary: '#FFD23F',
  accent: '#3BCEAC',
  danger: '#EE4266',
  info: '#4C6FFF',
  lilac: '#B79CED',
  peach: '#FF9F76',
  ink: '#111111',
  inkMuted: '#555555',
  inkLight: '#8A8A8A',
  paper: '#F8F8F6',
  cream: '#FFF6E2',
  mint: '#E3F8F0',
  night: '#141414',
  card: '#FFFFFF',
  overlay: 'rgba(17, 17, 17, 0.5)',
  white: '#FFFFFF',
  transparent: 'transparent',
} as const;

// Colors offered when creating a collection.
export const collectionColors = [
  '#FF7A1A',
  '#3D7BFF',
  '#2FB86A',
  '#1FBF9A',
  '#FFC21A',
  '#EE4266',
  '#8B5CF6',
  '#F06EAA',
  '#22B5E8',
  '#8A8A8A',
] as const;

// Feather icon names offered when creating a collection.
export const collectionIcons = [
  'folder',
  'bookmark',
  'star',
  'heart',
  'book-open',
  'coffee',
  'map-pin',
  'music',
  'film',
  'camera',
  'shopping-bag',
  'code',
  'briefcase',
  'globe',
  'gift',
  'zap',
] as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;

export const radius = { sm: 6, md: 10, lg: 14, xl: 20, full: 9999 } as const;

export const fonts = {
  regular: 'Sora_400Regular',
  medium: 'Sora_500Medium',
  semibold: 'Sora_600SemiBold',
  bold: 'Sora_700Bold',
  heavy: 'Sora_800ExtraBold',
} as const;

export const fontSize = { xxs: 10, xs: 11, sm: 12, base: 14, md: 16, lg: 18, xl: 22, xxl: 28, huge: 34 } as const;

export const brutal = {
  border: 2.5,
  borderThin: 1.5,
  shadow: { boxShadow: '4px 4px 0px #111111' },
  shadowSmall: { boxShadow: '2px 2px 0px #111111' },
  shadowNone: { boxShadow: '0px 0px 0px transparent' },
} as const;
