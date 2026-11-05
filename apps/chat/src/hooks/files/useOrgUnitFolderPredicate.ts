import {
  toSectionApiPath,
  type DialFileManagerSection,
} from '@epam/ai-dial-chat-hooks';
import {
  DialFileManagerTabs,
  type DialFile,
} from '@epam/ai-dial-react-file-manager';
import { useCallback, useEffect } from 'react';
import { useOrgUnitsContext } from '../../context/OrgUnitsContext';

/**
 * Tells the file manager which folder rows are DIAL Core org units. Only rows
 * under the Organization root (its own tab, or its section of the All tab)
 * can match, since units live in the public bucket. `sections` are the ones
 * the file manager renders, so a row resolves to the same root it is shown
 * under. Starts the shared org-unit read the first time a file manager renders.
 */
export const useOrgUnitFolderPredicate = (
  sections: readonly DialFileManagerSection[],
): ((item: DialFile) => boolean) => {
  const { ensureUnits, isOrgUnitFolder } = useOrgUnitsContext();

  useEffect(() => {
    ensureUnits();
  }, [ensureUnits]);

  return useCallback(
    (item: DialFile): boolean => {
      const publicPath = toSectionApiPath(
        item.path,
        sections,
        DialFileManagerTabs.Organization,
      );
      return publicPath != null && isOrgUnitFolder(publicPath);
    },
    [isOrgUnitFolder, sections],
  );
};
