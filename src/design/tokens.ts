import { useMemo } from 'react';
import { lightColors, darkColors, courseColors, importColors } from './colors';
import type { SemanticColors } from './colors';
import { fontWeight, fontSize, lineHeight } from './typography';
import { spacing, borderRadius, touchTarget, iconSize } from './spacing';

export interface DesignTokens {
  colors: SemanticColors;
  courseColors: readonly string[];
  importColors: readonly string[];
  fontWeight: typeof fontWeight;
  fontSize: typeof fontSize;
  lineHeight: typeof lineHeight;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  touchTarget: number;
  iconSize: typeof iconSize;
}

export function createTokens(darkMode: boolean): DesignTokens {
  return {
    colors: (darkMode ? darkColors : lightColors) as SemanticColors,
    courseColors,
    importColors,
    fontWeight,
    fontSize,
    lineHeight,
    spacing,
    borderRadius,
    touchTarget,
    iconSize,
  };
}

export function useTokens(darkMode: boolean): DesignTokens {
  return useMemo(() => createTokens(darkMode), [darkMode]);
}

export {
  lightColors,
  darkColors,
  courseColors,
  importColors,
  fontWeight,
  fontSize,
  lineHeight,
  spacing,
  borderRadius,
  touchTarget,
  iconSize,
};

export type { SemanticColors };
