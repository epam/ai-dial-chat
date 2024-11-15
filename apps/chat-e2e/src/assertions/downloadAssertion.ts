import { LatestExportFormat } from '@/chat/types/import-export';
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

  public async assertEntitiesAreNotExported(
    downloadedData: UploadDownloadData,
    ...excludedEntityIds: string[]
  ) {
    const fileData = FileUtil.readFileData(
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
