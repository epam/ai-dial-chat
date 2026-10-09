import type { SettingsPanelItem } from '@epam/ai-dial-settings-panel';
import { DIAL_ICON_SIZE, DIAL_KIT_ICON_STROKE } from '@epam/ai-dial-ui-kit';
import {
  IconAdjustmentsHorizontal,
  IconChartBar,
  IconPlugConnected,
} from '@tabler/icons-react';
import type { ComponentType } from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BasicI18nKeys, SettingsI18nKeys } from '../constants/translation-keys';
import { useFeatureFlag } from '../context/AppConfigContext';
import ExtensionsTab from '../pages/SettingsPage/ExtensionsTab/ExtensionsTab';
import PreferencesTab from '../pages/SettingsPage/PreferencesTab/PreferencesTab';
import UsageTab from '../pages/SettingsPage/UsageTab/UsageTab';
import { SettingsTabs } from '../types/settings-tabs';

export interface SettingsTabConfigEntry {
  item: SettingsPanelItem;
  Component: ComponentType;
}

export interface UseSettingsTabConfigResult {
  items: SettingsPanelItem[];
  tabComponents: Partial<Record<SettingsTabs, ComponentType>>;
}

/*
 * A single source of truth for the Settings tab list: adding a future tab is
 * one new entry here, with no change to SettingsPage's rendering logic.
 */
export const useSettingsTabConfig = (): UseSettingsTabConfigResult => {
  const { t } = useTranslation();
  const isScheduledTasksEnabled = useFeatureFlag('scheduledTasksEnabled');

  const entries: SettingsTabConfigEntry[] = useMemo(
    () => [
      {
        item: {
          id: SettingsTabs.Preferences,
          label: t(SettingsI18nKeys.Preferences),
          icon: (
            <IconAdjustmentsHorizontal
              size={DIAL_ICON_SIZE.MD}
              aria-hidden
              stroke={DIAL_KIT_ICON_STROKE}
            />
          ),
        },
        Component: PreferencesTab,
      },
      {
        item: {
          id: SettingsTabs.Usage,
          label: t(BasicI18nKeys.Usage),
          icon: (
            <IconChartBar
              size={DIAL_ICON_SIZE.MD}
              aria-hidden
              stroke={DIAL_KIT_ICON_STROKE}
            />
          ),
        },
        Component: UsageTab,
      },
      /*
       * The Extensions entry is withheld unless the feature behind its whole
       * domain is on: the BFF's offline-credentials endpoints 403 unless
       * `scheduledTasksEnabled`/`liveChatInteraction` is enabled, so an
       * always-rendered tab would show a permanently dead section.
       */
      ...(isScheduledTasksEnabled
        ? [
            {
              item: {
                id: SettingsTabs.Extensions,
                label: t(SettingsI18nKeys.Extensions),
                icon: (
                  <IconPlugConnected
                    size={DIAL_ICON_SIZE.MD}
                    aria-hidden
                    stroke={DIAL_KIT_ICON_STROKE}
                  />
                ),
              },
              Component: ExtensionsTab as ComponentType,
            },
          ]
        : []),
    ],
    [t, isScheduledTasksEnabled],
  );

  return useMemo(
    () => ({
      items: entries.map((entry) => entry.item),
      tabComponents: entries.reduce(
        (acc, entry) => {
          acc[entry.item.id as SettingsTabs] = entry.Component;
          return acc;
        },
        {} as Partial<Record<SettingsTabs, ComponentType>>,
      ),
    }),
    [entries],
  );
};
