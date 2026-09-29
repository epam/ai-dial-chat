import type { DialFileManagerShellLabels } from '@epam/ai-dial-chat-shared';
import { DialFileManagerTabs } from '@epam/ai-dial-react-file-manager';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DialFileManagerI18nKeys } from '../../constants/translation-keys';

/**
 * Returns the translated file-manager search placeholders, keyed by the source
 * tab being browsed, so the field names the storage it actually searches.
 */
export const useSearchPlaceholderByTab = (): NonNullable<
  DialFileManagerShellLabels['searchPlaceholderByTab']
> => {
  const { t } = useTranslation();

  return useMemo(
    () => ({
      [DialFileManagerTabs.MyFiles]: t(
        DialFileManagerI18nKeys.SearchPlaceholderMyFiles,
      ),
      [DialFileManagerTabs.Shared]: t(
        DialFileManagerI18nKeys.SearchPlaceholderShared,
      ),
      [DialFileManagerTabs.Organization]: t(
        DialFileManagerI18nKeys.SearchPlaceholderOrganization,
      ),
    }),
    [t],
  );
};
