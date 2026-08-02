/**
 * Compute the best contrasting text color (dark or light) for a given
 * background hex color, using W3C WCAG 2.0 relative luminance.
 *
 * When `alpha` is provided, returns an `rgba()` string with that opacity —
 * useful for secondary text on colored backgrounds.
 *
 * Returns '#0F172A' (dark text) for light backgrounds and '#FFFFFF' for
 * dark backgrounds — theme-independent so it works across light/dark mode
 * when the background is a fixed course color.
 */
export function getOnColor(hex: string, alpha?: number): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  // W3C relative luminance formula
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const isLight = luminance > 0.5;
  if (alpha !== undefined) {
    return isLight
      ? `rgba(15, 23, 42, ${alpha})`
      : `rgba(255, 255, 255, ${alpha})`;
  }
  return isLight ? '#0F172A' : '#FFFFFF';
}
