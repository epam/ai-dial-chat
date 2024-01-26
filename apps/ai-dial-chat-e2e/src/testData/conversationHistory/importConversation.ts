import { Conversation } from '@/ai-dial-chat/types/chat';
import { LatestExportFormat } from '@/ai-dial-chat/types/export';
import { FolderConversation } from '@/src/testData';
import { UploadDownloadData } from '@/src/ui/pages';
import { FileUtil } from '@/src/utils/fileUtil';

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
