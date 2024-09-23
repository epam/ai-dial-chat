import { AddonsSelectors } from './addons/addons.reducers';
import { ApplicationSelectors } from './application/application.reducers';
import { AuthSelectors } from './auth/auth.reducers';
import { ConversationsSelectors } from './conversations/conversations.reducers';
import { FilesSelectors } from './files/files.reducers';
import { useAppSelector } from './hooks';
import { ImportExportSelectors } from './import-export/importExport.reducers';
import { MigrationSelectors } from './migration/migration.reducers';
import { ModelsSelectors } from './models/models.reducers';
import { OverlaySelectors } from './overlay/overlay.reducers';
import { PromptsSelectors } from './prompts/prompts.reducers';
import { PublicationSelectors } from './publication/publication.reducers';
import { ServiceSelectors } from './service/service.reducer';
import { SettingsSelectors } from './settings/settings.reducers';
import { ShareSelectors } from './share/share.reducers';
import { UISelectors } from './ui/ui.reducers';

import { createUseStoreSelectors } from '@epam/modulify-toolkit';

const StoreSelectors = {
  AddonsSelectors,
  ApplicationSelectors,
  AuthSelectors,
  ConversationsSelectors,
  FilesSelectors,
  ImportExportSelectors,
  MigrationSelectors,
  ModelsSelectors,
  OverlaySelectors,
  PromptsSelectors,
  PublicationSelectors,
  ServiceSelectors,
  SettingsSelectors,
  ShareSelectors,
  UISelectors,
};

export const useStoreSelectors = createUseStoreSelectors(
  StoreSelectors,
  useAppSelector,
);
export type StoreSelectorsHook = typeof useStoreSelectors;

// Here is a "Manual mode" if using of "createStoreSelectorsHook" seems overcomplicated
// export const useStoreSelectors = () => ({
//     useAddonsSelectors: createSelectorsHook(AddonsSelectors),
//     useApplicationSelectors: createSelectorsHook(ApplicationSelectors),
//     useAuthSelectors: createSelectorsHook(AuthSelectors),
//     useConversationsSelectors: createSelectorsHook(ConversationsSelectors),
//     useFilesSelectors: createSelectorsHook(FilesSelectors),
//     useImportExportSelectors: createSelectorsHook(ImportExportSelectors),
//     useMigrationSelectors: createSelectorsHook(MigrationSelectors),
//     useModelsSelectors: createSelectorsHook(ModelsSelectors),
//     useOverlaySelectors: createSelectorsHook(OverlaySelectors),
//     usePromptsSelectors: createSelectorsHook(PromptsSelectors),
//     usePublicationSelectors: createSelectorsHook(PublicationSelectors),
//     useServiceSelectors: createSelectorsHook(ServiceSelectors),
//     useSettingsSelectors: createSelectorsHook(SettingsSelectors),
//     useShareSelectors: createSelectorsHook(ShareSelectors),
//     useUISelectors: createSelectorsHook(UISelectors)
// });
