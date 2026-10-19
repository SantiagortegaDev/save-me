// SaveMe design tokens. Neo-brutalist: flat fills, thick ink outlines, hard offset shadows.
// Colors are mutable so the whole app can switch between light and dark; see applyScheme().

export type Scheme = 'light' | 'dark';

const LIGHT = {
  primary: '#FFD23F',
  accent: '#3BCEAC',
  danger: '#EE4266',
  info: '#4C6FFF',
  lilac: '#B79CED',
  peach: '#FF9F76',
  // Outlines, and content drawn on bright fills (yellow buttons, colored badges). Dark in both schemes.
  ink: '#111111',
  // Body text and icons on the page.
  text: '#111111',
  inkMuted: '#555555',
  inkLight: '#8A8A8A',
  paper: '#F8F8F6',
  card: '#FFFFFF',
  // Inputs, chips, icon buttons and other small controls.
  surface: '#FFFFFF',
  cream: '#FFF6E2',
  mint: '#E3F8F0',
  sunny: '#FFE68A',
  selected: '#FFF1DE',
  pressed: '#F2F2EE',
  placeholder: '#F1EADB',
  track: '#D6D6D6',
  night: '#141414',
  overlay: 'rgba(17, 17, 17, 0.5)',
  white: '#FFFFFF',
  transparent: 'transparent',
};

const DARK: typeof LIGHT = {
  ...LIGHT,
  ink: '#050505',
  text: '#F2F2F2',
  inkMuted: '#B4B4B4',
  inkLight: '#808080',
  paper: '#1A1A1A',
  card: '#262626',
  surface: '#303030',
  cream: '#3A3324',
  mint: '#1D3A31',
  sunny: '#E8C534',
  selected: '#3C3423',
  pressed: '#383838',
  placeholder: '#333333',
  track: '#555555',
  night: '#101010',
  overlay: 'rgba(0, 0, 0, 0.65)',
};

export const colors = { ...LIGHT };

export const brutal = {
  border: 2.5,
  borderThin: 1.5,
  shadow: { boxShadow: '4px 4px 0px #111111' },
  shadowSmall: { boxShadow: '2px 2px 0px #111111' },
  shadowNone: { boxShadow: '0px 0px 0px transparent' },
};

let version = 0;
let current: Scheme = 'light';

export function currentScheme(): Scheme {
  return current;
}

export function applyScheme(scheme: Scheme): void {
  if (scheme === current) return;
  current = scheme;
  Object.assign(colors, scheme === 'dark' ? DARK : LIGHT);
  const shadow = scheme === 'dark' ? '#000000' : '#111111';
  brutal.shadow.boxShadow = `4px 4px 0px ${shadow}`;
  brutal.shadowSmall.boxShadow = `2px 2px 0px ${shadow}`;
  version++;
}

// Lazily (re)builds a style object for the active scheme. Use instead of a module-level StyleSheet.create.
export function themed<T extends object>(factory: () => T): T {
  let builtFor = -1;
  let cache: T;
  return new Proxy({} as T, {
    get(_target, key) {
      if (builtFor !== version) {
        cache = factory();
        builtFor = version;
      }
      return cache[key as keyof T];
    },
  });
}

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
