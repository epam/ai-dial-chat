import { UploadDownloadData } from '@/src/ui/pages';
import { expect } from '@playwright/test';

export class DownloadAssertion {
  public async assertDownloadFileExtension(
    downloadedData: UploadDownloadData,
    expectedExtension: string,
  ) {
    expect(downloadedData.path).toBeTruthy();
    expect(downloadedData.path).toMatch(new RegExp(`${expectedExtension}$`));
  }
}
