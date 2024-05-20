import { Prompt } from '@/chat/types/prompt';
import { ImportPromtsResponse } from '@/chat/utils/app/import-export';
import { FolderPrompt } from '@/src/testData';
import { UploadDownloadData } from '@/src/ui/pages';
import { ItemUtil } from '@/src/utils';
import { FileUtil } from '@/src/utils/fileUtil';

export class ImportPrompt {
  public static preparePromptFile(
    importedPrompt: Prompt,
    importedFolder?: FolderPrompt,
  ): UploadDownloadData {
    if (importedFolder) {
      importedPrompt.folderId = importedFolder.folders.name;
      importedPrompt.folderId = ItemUtil.getApiPromptFolderId(importedPrompt);

      if (!importedPrompt.id.includes(importedFolder.folders.name)) {
        importedPrompt.id = `${importedPrompt.folderId}/${importedPrompt.id}`;
      }

      importedFolder.folders.id = importedPrompt.folderId;
      importedFolder.folders.folderId = ItemUtil.getPromptBucketPath();
    } else {
      importedPrompt.folderId = ItemUtil.getApiPromptFolderId(importedPrompt);
      importedPrompt.id = ItemUtil.getApiPromptId(importedPrompt);
    }

    const folderPromptToImport: ImportPromtsResponse = {
      prompts: [importedPrompt],
      folders: importedFolder ? [importedFolder.folders] : [],
      isError: false,
    };
    return {
      path: FileUtil.writeDataToFile(folderPromptToImport),
    };
  }
}
