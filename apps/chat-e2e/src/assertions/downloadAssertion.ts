import { ExpectedMessages } from '@/src/testData';
import { UploadDownloadData } from '@/src/ui/pages';
import { FileUtil } from '@/src/utils';
import { expect } from '@playwright/test';

export class DownloadAssertion {
  public async assertDownloadFileExtension(
    downloadedData: UploadDownloadData,
    expectedExtension: string,
  ) {
    expect(downloadedData.path).toBeTruthy();
    expect(downloadedData.path).toMatch(new RegExp(`${expectedExtension}$`));
  }

  public async assertJsonFileIsDownloaded(downloadedData: UploadDownloadData) {
    const downloadedFiles = FileUtil.getExportedFiles();
    expect
      .soft(
        downloadedFiles?.find(
          (f) =>
            f.includes(downloadedData.path) &&
            FileUtil.readJsonFileData(downloadedData.path) !== undefined,
        ),
        ExpectedMessages.dataIsExported,
      )
      .toBeDefined();
  }

  public async assertFileIsDownloaded(downloadedData: UploadDownloadData) {
    const downloadedFiles = FileUtil.getExportedFiles();
    expect
      .soft(
        downloadedFiles?.find(
          (f) =>
            f.includes(downloadedData.path) &&
            FileUtil.readFileData(downloadedData.path) !== undefined,
        ),
        ExpectedMessages.dataIsExported,
      )
      .toBeDefined();
  }
}
