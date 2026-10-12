import { PALETTE, shade } from '../config';

/** Mirror the palette into CSS variables so config.ts stays the single source of colour. */
export function applyPaletteCssVars(): void {
  const hex = (n: number): string => '#' + n.toString(16).padStart(6, '0');
  const style = document.documentElement.style;
  for (const [name, value] of Object.entries(PALETTE)) style.setProperty(`--${name}`, hex(value));
  style.setProperty('--ink', hex(shade(PALETTE.road, 0.4)));
}
