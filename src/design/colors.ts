export const lightColors = {
  bg: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F5F9',
  primary: '#0D9488',
  onPrimary: '#FFFFFF',
  secondary: '#475569',
  onSecondary: '#FFFFFF',
  accent: '#EA580C',
  onAccent: '#FFFFFF',
  border: '#E2E8F0',
  destructive: '#DC2626',
  onDestructive: '#FFFFFF',
  success: '#16A34A',
  warning: '#CA8A04',
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  overlay: 'rgba(15, 23, 42, 0.5)',
  ripple: 'rgba(13, 148, 136, 0.12)',
} as const;

export const darkColors = {
  bg: '#0F172A',
  surface: '#1E293B',
  surfaceAlt: '#162032',
  primary: '#2DD4BF',
  onPrimary: '#0F172A',
  secondary: '#94A3B8',
  onSecondary: '#0F172A',
  accent: '#FB923C',
  onAccent: '#0F172A',
  border: '#334155',
  destructive: '#EF4444',
  onDestructive: '#FFFFFF',
  success: '#22C55E',
  warning: '#FACC15',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  overlay: 'rgba(0, 0, 0, 0.6)',
  ripple: 'rgba(45, 212, 191, 0.15)',
} as const;

export interface SemanticColors {
  bg: string;
  surface: string;
  surfaceAlt: string;
  primary: string;
  onPrimary: string;
  secondary: string;
  onSecondary: string;
  accent: string;
  onAccent: string;
  border: string;
  destructive: string;
  onDestructive: string;
  success: string;
  warning: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  overlay: string;
  ripple: string;
}

export const courseColors = [
  '#0D9488',
  '#2563EB',
  '#7C3AED',
  '#DB2777',
  '#EA580C',
  '#CA8A04',
  '#16A34A',
  '#475569',
] as const;

export const importColors = [
  ...courseColors,
  '#0891B2',
  '#9333EA',
] as const;
