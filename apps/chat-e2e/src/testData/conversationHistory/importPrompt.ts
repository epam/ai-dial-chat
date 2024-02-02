import { Prompt } from '@/chat/types/prompt';
import { ImportPromtsResponse } from '@/chat/utils/app/import-export';
import { FolderPrompt } from '@/src/testData';
import { UploadDownloadData } from '@/src/ui/pages';
import { FileUtil } from '@/src/utils/fileUtil';

export class ImportPrompt {
  public static preparePromptFile(
    importedPrompt: Prompt,
    importedFolder?: FolderPrompt,
  ): UploadDownloadData {
    importedPrompt.folderId = importedFolder
      ? importedFolder.folders.id
      : undefined;
    const folderPromptToImport: ImportPromtsResponse = {
      prompts: [importedPrompt],
      folders: importedFolder ? [importedFolder.folders] : [],
      isError: false,
    };
    return {
      path: FileUtil.writeDataToFile(folderPromptToImport),
      isDownloadedData: false,
    };
  }
}
