import {
  UnsavedChangesProvider as SharedUnsavedChangesProvider,
  useIsMobile,
  type UnsavedChangesLabels,
} from '@epam/ai-dial-chat-shared';
import { FC, ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { UnsavedChangesI18nKeys } from '../constants/translation-keys';

interface Props {
  children: ReactNode;
}

/**
 * Mounts the shared `UnsavedChangesProvider` from `@epam/ai-dial-chat-shared`
 * with the app's translated dialog copy. Builder pages feed it through
 * `useBuilderLeaveGuard`; `Navigation` reads `useUnsavedChanges` to guard
 * Log out.
 */
export const UnsavedChangesProvider: FC<Props> = ({ children }) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const labels = useMemo<UnsavedChangesLabels>(
    () => ({
      title: t(UnsavedChangesI18nKeys.Title),
      message: t(UnsavedChangesI18nKeys.Message),
      confirmLabel: t(
        isMobile
          ? UnsavedChangesI18nKeys.ConfirmLabelMobile
          : UnsavedChangesI18nKeys.ConfirmLabel,
      ),
      cancelLabel: t(UnsavedChangesI18nKeys.CancelLabel),
    }),
    [isMobile, t],
  );

  return (
    <SharedUnsavedChangesProvider labels={labels}>
      {children}
    </SharedUnsavedChangesProvider>
  );
};
