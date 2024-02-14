import { isApiStorageType } from '@/src/hooks/global-setup';
import {
  FolderConversation,
  TestConversation,
  TestFolder,
  TestPrompt,
} from '@/src/testData';
import { UploadDownloadData } from '@/src/ui/pages';
import { ItemUtil } from '@/src/utils';
import { FileUtil } from '@/src/utils/fileUtil';

export interface TestImportFormat {
  history: TestConversation[];
  folders: TestFolder[];
  prompts: TestPrompt[];
  version?: number;
}

export class ImportConversation {
  public static prepareConversationFile(
    importedConversation: TestConversation,
    importedFolder?: FolderConversation,
  ): UploadDownloadData {
    ImportConversation.setImportedItemAttributes(
      importedConversation,
      importedFolder,
    );
    const folderConversationToImport: TestImportFormat = {
      folders: importedFolder ? [importedFolder.folders] : [],
      history: [importedConversation],
      prompts: [],
    };
    isApiStorageType
      ? (folderConversationToImport.version = 5)
      : (folderConversationToImport.version = 4);
    return {
      path: FileUtil.writeDataToFile(folderConversationToImport),
      isDownloadedData: false,
    };
  }

  private static setImportedItemAttributes(
    importedConversation: TestConversation,
    importedFolder?: FolderConversation,
  ) {
    if (isApiStorageType) {
      if (importedFolder) {
        importedFolder.folders.id = ItemUtil.getApiConversationFolderId(
          importedFolder.folders.name,
        );
        importedConversation.folderId = importedFolder.folders.id;
        importedConversation.id = ItemUtil.getApiConversationId(
          importedConversation,
          importedFolder.folders.name,
        );
      } else {
        importedConversation.id =
          ItemUtil.getApiConversationId(importedConversation);
      }
    } else {
      importedConversation.folderId = importedFolder
        ? importedFolder.folders.id
        : undefined;
    }
  }
}
