import type { ReactNode } from 'react';

/** One row rendered by {@link SettingsPanel}. */
export interface SettingsPanelItem {
  /** Stable identifier, matched against `SettingsPanelProps.activeId`. */
  id: string;
  /** Already-localized row label. */
  label: string;
  /** Row icon, rendered before the label. */
  icon?: ReactNode;
  /** Disabled rows cannot become active, render with a `not-allowed` cursor, and are skipped by keyboard navigation. Defaults to `false`. */
  disabled?: boolean;
}

/** Typography overrides for the {@link SettingsPanel} component. */
export interface SettingsPanelTypography {
  /** Typography class applied to the section header. Defaults to `'dial-tiny-lead-semi-text'` (auto-uppercases; pass the label sentence-case). */
  sectionLabelClassName?: string;
  /** Typography class applied to an inactive row's label. Defaults to `'dial-small-text'`. */
  itemLabelClassName?: string;
  /** Typography class applied to the active row's label. Defaults to `'dial-small-semi-text'`. */
  activeItemLabelClassName?: string;
}

/** Color overrides for the {@link SettingsPanel} component, applied as CSS custom properties. */
export interface SettingsPanelColors {
  /** Label color of the section header. Defaults to `--text-secondary`. */
  sectionLabelText?: string;
  /** Label and icon color of an inactive row (enabled or disabled). Defaults to `--text-secondary`. */
  rowText?: string;
  /** Background color of an enabled, inactive row on hover. Defaults to `--bg-control-accent-alpha-hover`. */
  rowBackgroundHover?: string;
  /** Background color of the active row. Defaults to `--bg-control-accent-alpha`. */
  activeRowBackground?: string;
  /** Background color of the active row on hover. Defaults to `--bg-control-accent-alpha-hover`. */
  activeRowBackgroundHover?: string;
  /** Label and icon color of the active row. Defaults to `--text-accent`. */
  activeRowText?: string;
}

/** Style overrides for the {@link SettingsPanel} component. */
export interface SettingsPanelStyles {
  /** Typography overrides. */
  typography?: SettingsPanelTypography;
  /** Color overrides applied as CSS custom properties. */
  colors?: SettingsPanelColors;
}

/** Props for {@link SettingsPanel}. */
export interface SettingsPanelProps {
  /** Rows to render, top to bottom. */
  items: SettingsPanelItem[];
  /** `id` of the currently selected item. */
  activeId: string;
  /** Fired with an item's `id` when the user selects an enabled row that is not already active. */
  onSelect: (id: string) => void;
  /** Already-localized header text rendered above the item list. Omit to render no header. */
  sectionLabel?: string;
  /** Style overrides. */
  styles?: SettingsPanelStyles;
  /** Additional CSS class applied to the root element. */
  className?: string;
}
