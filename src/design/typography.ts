export const fontWeight = {
  display: '800' as const,
  heading: '700' as const,
  subheading: '600' as const,
  body: '400' as const,
  caption: '400' as const,
  label: '500' as const,
};

export const fontSize = {
  display: 28,
  heading: 20,
  subheading: 16,
  body: 14,
  caption: 12,
  label: 11,
} as const;

export const lineHeight = {
  display: 1.2,
  heading: 1.3,
  subheading: 1.3,
  body: 1.5,
  caption: 1.4,
  label: 1.3,
} as const;

export type FontWeightKey = keyof typeof fontWeight;
export type FontSizeKey = keyof typeof fontSize;
