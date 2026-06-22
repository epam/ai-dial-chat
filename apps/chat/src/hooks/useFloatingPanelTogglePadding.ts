import { useMemo } from 'react';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/selectors';

import { Feature } from '@epam/ai-dial-shared';
import uniq from 'lodash-es/uniq';

export const useFloatingPanelTogglePadding = () => {
  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );

  return useMemo(() => {
    if (enabledFeatures.has(Feature.Header)) {
      return {
        hasFloatingPanelToggles: false,
        headerClassNames: '',
      };
    }

    const classes: string[] = [];

    const hasFloatingPanelToggles =
      enabledFeatures.has(Feature.ConversationsPanelToggle) ||
      enabledFeatures.has(Feature.PromptsPanelToggle);

    if (hasFloatingPanelToggles) {
      classes.push('py-4');
    }

    if (hasFloatingPanelToggles) {
      classes.push('px-14', 'md:px-14');
    }

    return {
      hasFloatingPanelToggles,
      headerClassNames: uniq(classes).join(' '),
    };
  }, [enabledFeatures]);
};
