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
  /** Typography class applied to the section header. Defaults to `'dial-h1-text'`. */
  sectionLabelClassName?: string;
}

/** Style overrides for the {@link SettingsPanel} component. */
export interface SettingsPanelStyles {
  /** Typography overrides. */
  typography?: SettingsPanelTypography;
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
