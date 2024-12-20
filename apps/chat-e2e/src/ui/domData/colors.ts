export enum Colors {
  backgroundAccentSecondary = 'rgba(55, 186, 188, 0.15)',
  textPrimary = 'rgb(243, 244, 246)',
  textAccentSecondary = 'rgb(55, 186, 188)',
  backgroundAccentTertiary = 'rgb(169, 114, 255)',
  textError = 'rgb(247, 100, 100)',
  controlsBackgroundAccent = 'rgb(92, 141, 234)',
  controlsBackgroundAccentPrimary = 'rgb(39, 100, 217)',
  controlsBackgroundDisable = 'rgb(127, 135, 146)',
  // eslint-disable-next-line @typescript-eslint/no-duplicate-enum-values
  textSecondary = 'rgb(169, 114, 255)',
  defaultBackground = 'rgba(0, 0, 0, 0)',
  textPermanent = 'rgb(252, 252, 252)',
  backgroundAccentPrimaryAlpha = 'rgba(92, 141, 234, 0.17)',
  backgroundLayer4Dark = 'rgb(66, 73, 82)',
  backgroundLayer4Light = 'rgb(195, 201, 208)',
  backgroundLayer3Dark = 'rgb(34, 41, 50)',
  // eslint-disable-next-line @typescript-eslint/no-duplicate-enum-values
  backgroundLayer3Light = 'rgb(252, 252, 252)',
  // eslint-disable-next-line @typescript-eslint/no-duplicate-enum-values
  backgroundAccentSecondaryAlphaDark = 'rgba(55, 186, 188, 0.15)',
  backgroundAccentSecondaryLight = 'rgb(0, 157, 159)',
  backgroundAccentSecondaryAlphaLight = 'rgba(0, 157, 159, 0.1)',
  backgroundAccentTertiaryAlphaDark = 'rgba(169, 114, 255, 0.17)',
  backgroundAccentTertiaryAlphaLight = 'rgba(132, 62, 243, 0.1)',
  textAccentTertiaryLight = 'rgb(132, 62, 243)',
  // eslint-disable-next-line @typescript-eslint/no-duplicate-enum-values
  controlsTextDisable = 'rgb(66, 73, 82)',
}

export function removeAlpha(color: string): string {
  if (color.startsWith('rgba')) {
    const [r, g, b] = color.match(/\d+/g)!.map(Number);
    return `rgb(${r}, ${g}, ${b})`;
  }
  return color;
}

// Wrapper for Colors enum without alpha channels
export const ColorsWithoutAlpha = Object.fromEntries(
  Object.entries(Colors).map(([key, value]) => [key, removeAlpha(value)]),
) as typeof Colors;

export enum ThemeColorAttributes {
  textAccentTertiary = 'text-accent-tertiary',
}
