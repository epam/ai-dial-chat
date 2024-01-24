import { ImportPromtsResponse } from '@/ai-dial-chat/utils/app/import-export';
import { FileUtil } from '@/src/utils/fileUtil';

import { Prompt } from '@/ai-dial-chat/types/prompt';

import { FolderPrompt } from '@/src/testData';
import { UploadDownloadData } from '@/src/ui/pages';

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
