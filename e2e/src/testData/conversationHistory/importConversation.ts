import { FileUtil } from '@/e2e/src/utils/fileUtil';

import { Conversation } from '@/src/types/chat';
import { LatestExportFormat } from '@/src/types/importExport';

import { FolderConversation } from '@/e2e/src/testData';
import { UploadDownloadData } from '@/e2e/src/ui/pages';

export class ImportConversation {
  public static prepareConversationFile(
    importedConversation: Conversation,
    importedFolder?: FolderConversation,
  ): UploadDownloadData {
    importedConversation.folderId = importedFolder
      ? importedFolder.folders.id
      : undefined;
    const folderConversationToImport: LatestExportFormat = {
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
}
