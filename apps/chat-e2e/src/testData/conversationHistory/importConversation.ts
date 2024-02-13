import { Conversation } from '@/chat/types/chat';
import { isApiStorageType } from '@/src/hooks/global-setup';
import { FolderConversation } from '@/src/testData';
import { UploadDownloadData } from '@/src/ui/pages';
import { ConversationUtil } from '@/src/utils';
import { FileUtil } from '@/src/utils/fileUtil';

export class ImportConversation {
  public static prepareConversationFile(
    importedConversation: Conversation,
    importedFolder?: FolderConversation,
  ): UploadDownloadData {
    ImportConversation.setImportedItemAttributes(
      importedConversation,
      importedFolder,
    );
    const folderConversationToImport = isApiStorageType
      ? {
          folders: importedFolder ? [importedFolder.folders] : [],
          history: [importedConversation],
          prompts: [],
          version: 5,
        }
      : {
          folders: importedFolder ? [importedFolder.folders] : [],
          history: [importedConversation],
          prompts: [],
          version: 4,
        };
    return {
      path: FileUtil.writeDataToFile(folderConversationToImport),
      isDownloadedData: false,
    };
  }

  private static setImportedItemAttributes(
    importedConversation: Conversation,
    importedFolder?: FolderConversation,
  ) {
    if (isApiStorageType) {
      if (importedFolder) {
        importedFolder.folders.id = importedFolder.folders.name;
        importedConversation.folderId = importedFolder.folders.id;
        importedConversation.id = `${importedConversation.folderId}/${ConversationUtil.getApiConversationId(importedConversation)}`;
      } else {
        importedConversation.id =
          ConversationUtil.getApiConversationId(importedConversation);
      }
    } else {
      importedConversation.folderId = importedFolder
        ? importedFolder.folders.id
        : undefined;
    }
  }
}
