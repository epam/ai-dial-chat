import { FileUtil } from '@/e2e/src/utils/fileUtil';
import { ImportPromtsResponse } from '@/src/utils/app/import-export';

import { Prompt } from '@/src/types/prompt';

import { FolderPrompt } from '@/e2e/src/testData';
import { UploadDownloadData } from '@/e2e/src/ui/pages';

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
