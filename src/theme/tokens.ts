export type ColorScheme = 'light' | 'dark';

export type Palette = {
  background: string;
  surface: string;
  surfaceMuted: string;
  surfaceSunken: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  accent: string;
  accentSoft: string;
  accentBorder: string;
  accentText: string;
  onAccent: string;
  success: string;
  successSoft: string;
  successBorder: string;
  successText: string;
  warning: string;
  warningSoft: string;
  warningBorder: string;
  warningText: string;
  danger: string;
  dangerSoft: string;
  dangerBorder: string;
  dangerText: string;
  overlay: string;
  skeleton: string;
  skeletonHighlight: string;
  shadow: string;
};

const light: Palette = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceMuted: '#F2F4F7',
  surfaceSunken: '#EDEFF3',
  border: '#EAECF0',
  borderStrong: '#D5D9E0',
  text: '#0F172A',
  textMuted: '#667085',
  textSubtle: '#98A2B3',
  accent: '#4F46E5',
  accentSoft: '#EEF2FF',
  accentBorder: '#C7D2FE',
  accentText: '#4338CA',
  onAccent: '#FFFFFF',
  success: '#059669',
  successSoft: '#ECFDF5',
  successBorder: '#A7F3D0',
  successText: '#047857',
  warning: '#D97706',
  warningSoft: '#FFFBEB',
  warningBorder: '#FDE68A',
  warningText: '#B45309',
  danger: '#E11D48',
  dangerSoft: '#FFF1F2',
  dangerBorder: '#FECDD3',
  dangerText: '#BE123C',
  overlay: 'rgba(246, 247, 249, 0.78)',
  skeleton: '#E7EAEF',
  skeletonHighlight: '#F5F6F8',
  shadow: '#0F172A',
};

const dark: Palette = {
  background: '#0A0E17',
  surface: '#141A26',
  surfaceMuted: '#1B2333',
  surfaceSunken: '#10161F',
  border: '#242D3D',
  borderStrong: '#33405A',
  text: '#F8FAFC',
  textMuted: '#94A3B8',
  textSubtle: '#64748B',
  accent: '#818CF8',
  accentSoft: '#1E2440',
  accentBorder: '#3B3F7A',
  accentText: '#A5B4FC',
  onAccent: '#0A0E17',
  success: '#34D399',
  successSoft: '#0E2A22',
  successBorder: '#166534',
  successText: '#6EE7B7',
  warning: '#FBBF24',
  warningSoft: '#2A2110',
  warningBorder: '#78350F',
  warningText: '#FCD34D',
  danger: '#FB7185',
  dangerSoft: '#2B1620',
  dangerBorder: '#7F1D3A',
  dangerText: '#FDA4AF',
  overlay: 'rgba(10, 14, 23, 0.78)',
  skeleton: '#1E2635',
  skeletonHighlight: '#2B3446',
  shadow: '#000000',
};

export const palettes: Record<ColorScheme, Palette> = { light, dark };

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
  pill: 999,
} as const;

/** Max content width on wide portrait tablets; phones stay full width below these caps. */
export const layoutWidth = {
  /** Soft cap on very wide portrait screens; primary constraint is window minus side padding. */
  content: 960,
  auth: 440,
  sheet: 560,
  dialog: 420,
  toast: 480,
} as const;

/** Minimum window width before wide-screen content sizing applies. */
export const layoutBreakpoint = {
  wide: 600,
} as const;

/**
 * Android ignores `fontWeight` on custom fonts, so every weight must be
 * addressed by its own family name.
 */
export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;
