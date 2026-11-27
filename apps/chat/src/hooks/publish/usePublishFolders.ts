import {
  usePublishFolders as usePublishFoldersState,
  type UsePublishFoldersResult,
} from '@epam/ai-dial-chat-hooks';
import { useCallback } from 'react';
import { useOrgUnitsContext } from '../../context/OrgUnitsContext';
import { listPublicFiles } from '../../server-api/files.api';
import { StorageKey } from '../../types/storage-key';
import useLocalStorage from '../useLocalStorage';

/**
 * App-edge wrapper around the lib's `usePublishFolders`: supplies the public
 * files listing and persists the destinations the user has published to.
 * `canPublishTo` is forwarded when the org-unit rule applies, and the org-unit
 * visibility rule hides public folders that are neither inside an org unit nor
 * on the way to one (nothing is hidden until the units are `Ready`; the panels'
 * folder guards start that read). The hook itself never touches browser storage (library isolation), so the
 * remembered list is read from and written back to `localStorage` here.
 */
export const usePublishFolders = ({
  canPublishTo,
}: {
  canPublishTo?: (folderPath: string[]) => boolean;
} = {}): UsePublishFoldersResult => {
  const [rememberedFolderKeys, setRememberedFolderKeys] = useLocalStorage<
    string[]
  >(StorageKey.PublishDestinationFolders, []);
  const { isPublicFolderVisible } = useOrgUnitsContext();

  const isFolderVisible = useCallback(
    (folderPath: string[]): boolean =>
      isPublicFolderVisible(folderPath.join('/')),
    [isPublicFolderVisible],
  );

  return usePublishFoldersState({
    listPublicFiles,
    rememberedFolderKeys,
    onRememberedFolderKeysChange: setRememberedFolderKeys,
    canPublishTo,
    isFolderVisible,
  });
};
