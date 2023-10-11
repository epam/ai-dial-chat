import { FileUtil } from '@/e2e/src/utils/fileUtil';

import { Conversation } from '@/src/types/chat';
import { LatestExportFormat } from '@/src/types/export';

import { FolderConversation } from '@/e2e/src/testData';

export class ImportConversation {
  public static prepareConversationFile(
    importedConversation: Conversation,
    importedFolder?: FolderConversation,
  ) {
    importedConversation.folderId = importedFolder
      ? importedFolder.folders.id
      : null;
    const folderConversationToImport: LatestExportFormat = {
      folders: importedFolder ? [importedFolder.folders] : [],
      history: [importedConversation],
      prompts: [],
      version: 4,
    };
    return FileUtil.writeDataToFile(folderConversationToImport);
  }
}
