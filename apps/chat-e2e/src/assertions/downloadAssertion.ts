import { LatestExportFormat } from '@/chat/types/import-export';
import { ExpectedMessages } from '@/src/testData';
import { UploadDownloadData } from '@/src/ui/pages';
import { FileUtil } from '@/src/utils';
import { expect } from '@playwright/test';

enum FileType {
  JSON = 'json',
  PLAIN = 'plain',
  // JPG = 'jpg',
}
type FileReader = (path: string) => string | Buffer | object | undefined;

export class DownloadAssertion {
  private static fileReaders: Record<FileType, FileReader> = {
    [FileType.JSON]: FileUtil.readJsonFileData,
    [FileType.PLAIN]: FileUtil.readPlainFileData,
    // [FileType.JPG]: FileUtil.readJpgFileData, //class can be extended to use with different file types
  };

  public async assertDownloadFileExtension(
    downloadedData: UploadDownloadData,
    expectedExtension: string,
  ) {
    expect(downloadedData.path).toBeTruthy();
    expect(downloadedData.path).toMatch(new RegExp(`${expectedExtension}$`));
  }

  public async assertFileIsDownloaded(
    downloadedData: UploadDownloadData,
    fileType: FileType,
  ) {
    const downloadedFiles = FileUtil.getExportedFiles();
    const fileExists = downloadedFiles?.some((file) =>
      file.includes(downloadedData.path),
    );
    expect.soft(fileExists, ExpectedMessages.dataIsExported).toBeTruthy();
    if (fileExists) {
      const fileReader = DownloadAssertion.fileReaders[fileType];
      const fileContent = fileReader(downloadedData.path);
      expect.soft(fileContent, ExpectedMessages.dataIsExported).toBeDefined();
    }
  }

  public async assertJsonFileIsDownloaded(downloadedData: UploadDownloadData) {
    await this.assertFileIsDownloaded(downloadedData, FileType.JSON);
  }

  public async assertPlainFileIsDownloaded(downloadedData: UploadDownloadData) {
    await this.assertFileIsDownloaded(downloadedData, FileType.PLAIN);
  }

  public async assertEntitiesAreNotExported(
    downloadedData: UploadDownloadData,
    ...excludedEntityIds: string[]
  ) {
    const fileData = FileUtil.readJsonFileData(
      downloadedData.path,
    ) as LatestExportFormat;
    for (const excludedEntityId of excludedEntityIds) {
      expect
        .soft(
          fileData.history.find((e) => e.id === excludedEntityId),
          ExpectedMessages.dataIsNotExported,
        )
        .toBeUndefined();
    }
  }
}
