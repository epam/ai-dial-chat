import { useMemo } from 'react';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/selectors';

import { Feature } from '@epam/ai-dial-shared';

/** 40px toggle + 8px container padding (p-2) on each side */
export const FLOATING_PANEL_TOGGLE_SIDE_OFFSET_PX = 48;

export const useFloatingPanelTogglePadding = () => {
  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );

  return useMemo(() => {
    if (enabledFeatures.has(Feature.Header)) {
      return '';
    }

    const classes: string[] = [];

    const hasFloatingPanelToggles =
      enabledFeatures.has(Feature.ConversationsPanelToggle) ||
      enabledFeatures.has(Feature.PromptsPanelToggle);

    if (hasFloatingPanelToggles) {
      classes.push('!py-4');
    }

    if (enabledFeatures.has(Feature.ConversationsPanelToggle)) {
      classes.push('!pl-12', 'md:!pl-12');
    }

    if (enabledFeatures.has(Feature.PromptsPanelToggle)) {
      classes.push('!pr-12', 'md:!pr-12');
    }

    return classes.join(' ');
  }, [enabledFeatures]);
};
