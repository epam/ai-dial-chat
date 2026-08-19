import type { SettingsPanelItem } from '@epam/ai-dial-settings-panel';
import { IconLayoutGrid } from '@tabler/icons-react';
import type { ComponentType } from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BasicI18nKeys } from '../constants/translation-keys';
import UsageTab from '../pages/SettingsPage/UsageTab/UsageTab';
import { SettingsTabs } from '../types/settings-tabs';

const ICON_SIZE = 20;

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

  const entries: SettingsTabConfigEntry[] = useMemo(
    () => [
      {
        item: {
          id: SettingsTabs.Usage,
          label: t(BasicI18nKeys.Usage),
          icon: <IconLayoutGrid size={ICON_SIZE} aria-hidden />,
        },
        Component: UsageTab,
      },
    ],
    [t],
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
