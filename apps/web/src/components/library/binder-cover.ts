import type { Layout } from "@sleevebook/binder-core";
import { resolveThemeTokens } from "../../lib/theme-presets";

// Cover color for the small binder previews. Same rule as the binder viewer
// (binder-stage.tsx deriveBinderColors): a dark solid theme background is the
// cover; gradients and light backgrounds get the default cover. Kept here
// because binder-stage.tsx is a client module and can't be imported by pages.
const DEFAULT_COVER = "#2f4a8a";
const DARK_COVER_MAX_LUMINANCE = 0.08;

function relativeLuminance(color: string): number | null {
  const match = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (!match?.[1]) {
    return null;
  }
  const value = Number.parseInt(match[1], 16);
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const [r = 0, g = 0, b = 0] = channels;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function binderCoverColor(theme: Layout["theme"]): string {
  const { background } = resolveThemeTokens(theme);
  const luminance = relativeLuminance(background);
  return luminance !== null && luminance < DARK_COVER_MAX_LUMINANCE ? background : DEFAULT_COVER;
}
