import { ROUTES } from '../types/routes';
import type { SettingsTabs } from '../types/settings-tabs';

/** Path segment `ROUTES.SettingsTab` substitutes per tab. */
const SETTINGS_TAB_PARAM = ':tab';

/** Returns the canonical path of one Settings tab, e.g. `/settings/usage`. */
export const buildSettingsTabPath = (tab: SettingsTabs): string =>
  ROUTES.SettingsTab.replace(SETTINGS_TAB_PARAM, tab);
