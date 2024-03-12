import { Conversation } from '@/chat/types/chat';
import { FolderInterface } from '@/chat/types/folder';
import { Prompt } from '@/chat/types/prompt';
import { isApiStorageType } from '@/src/hooks/global-setup';
import { FolderConversation } from '@/src/testData';
import { UploadDownloadData } from '@/src/ui/pages';
import { ItemUtil } from '@/src/utils';
import { FileUtil } from '@/src/utils/fileUtil';

export interface TestImportFormat {
  history: Conversation[];
  folders: FolderInterface[];
  prompts: Prompt[];
  version?: number;
}

export class ImportConversation {
  public static prepareConversationFile(
    importedConversation: Conversation,
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
    importedConversation: Conversation,
    importedFolder?: FolderConversation,
  ) {
    if (importedFolder) {
      importedConversation.folderId = importedFolder.folders.name;
      importedConversation.folderId =
        ItemUtil.getApiConversationFolderId(importedConversation);

      if (!importedConversation.id.includes(importedFolder.folders.name)) {
        importedConversation.id = `${importedConversation.folderId}/${importedConversation.id}`;
      }

      importedFolder.folders.id = importedConversation.folderId;
      importedFolder.folders.folderId = ItemUtil.getConversationBucketPath();
    } else {
      importedConversation.folderId =
        ItemUtil.getApiConversationFolderId(importedConversation);
      importedConversation.id =
        ItemUtil.getApiConversationId(importedConversation);
    }
  }
}
