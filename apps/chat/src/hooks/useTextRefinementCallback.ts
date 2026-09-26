import type { TextRefinementPurpose } from '@epam/ai-dial-chat-api-client';
import { useCallback } from 'react';
import { useAppConfig } from '../context/AppConfigContext';
import { refineText } from '../server-api/text-refinement.api';
import { UserConfigStatus } from '../types/user-config-status';

/** Supplies a stable field adapter only after the host's refinement capability is available. */
export const useTextRefinementCallback = (purpose: TextRefinementPurpose) => {
  const { config, status } = useAppConfig();
  const callback = useCallback(
    (value: string, signal: AbortSignal) => refineText(purpose, value, signal),
    [purpose],
  );
  return status === UserConfigStatus.Ready &&
    config.aiTextRefinementAvailable === true
    ? callback
    : undefined;
};
