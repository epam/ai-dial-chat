import {
  usePublishFolders as usePublishFoldersState,
  type UsePublishFoldersResult,
} from '@epam/ai-dial-chat-hooks';
import { listPublicFiles } from '../../server-api/files.api';
import { StorageKey } from '../../types/storage-key';
import useLocalStorage from '../useLocalStorage';

/**
 * App-edge wrapper around the lib's `usePublishFolders`: supplies the public
 * files listing and persists the destinations the user has published to.
 * The hook itself never touches browser storage (library isolation), so the
 * remembered list is read from and written back to `localStorage` here.
 */
export const usePublishFolders = (): UsePublishFoldersResult => {
  const [rememberedFolderKeys, setRememberedFolderKeys] = useLocalStorage<
    string[]
  >(StorageKey.PublishDestinationFolders, []);

  return usePublishFoldersState({
    listPublicFiles,
    rememberedFolderKeys,
    onRememberedFolderKeysChange: setRememberedFolderKeys,
  });
};
