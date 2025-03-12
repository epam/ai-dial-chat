import { LatestExportFormat } from '@/chat/types/import-export';
import { Attachment, ExpectedMessages } from '@/src/testData';
import { UploadDownloadData } from '@/src/ui/pages';
import { FileUtil } from '@/src/utils';
import { expect } from '@playwright/test';
import path from 'path';

export enum FileType {
  JSON = 'json',
  PLAIN = 'plain',
  JPG = 'jpg',
}
type FileReader = (path: string) => string | Buffer | object | undefined;

export class DownloadAssertion {
  private static fileReaders: Record<FileType, FileReader> = {
    [FileType.JSON]: FileUtil.readJsonFileData,
    [FileType.PLAIN]: FileUtil.readPlainFileData,
    [FileType.JPG]: FileUtil.readPlainFileData,
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
    expectedFilename?: string,
  ) {
    let fileReader;
    let fileContent;
    const downloadedFiles = FileUtil.getExportedFiles();
    const fileExists = downloadedFiles?.some((file) =>
      file.includes(downloadedData.path),
    );
    expect.soft(fileExists, ExpectedMessages.dataIsExported).toBeTruthy();
    if (fileExists) {
      fileReader = DownloadAssertion.fileReaders[fileType];
      fileContent = fileReader(downloadedData.path);
      expect.soft(fileContent, ExpectedMessages.dataIsExported).toBeDefined();
    }
    //verify downloaded file equals existing attachment
    if (expectedFilename) {
      //verify file name
      expect
        .soft(
          downloadedFiles?.find((f) => f.includes(expectedFilename)),
          ExpectedMessages.dataIsExported,
        )
        .toBeDefined();
      //verify file content
      if (fileReader) {
        const expectedFileContent = fileReader(
          path.join(Attachment.attachmentPath, expectedFilename),
        );
        expect
          .soft(fileContent, ExpectedMessages.fileContentIsValid)
          .toStrictEqual(expectedFileContent);
      } else {
        throw new Error('File reader is not defined for the specified type!');
      }
    }
  }

  public async assertJsonFileIsDownloaded(
    downloadedData: UploadDownloadData,
    expectedFilename?: string,
  ) {
    await this.assertFileIsDownloaded(
      downloadedData,
      FileType.JSON,
      expectedFilename,
    );
  }

  public async assertPlainFileIsDownloaded(
    downloadedData: UploadDownloadData,
    expectedFilename?: string,
  ) {
    await this.assertFileIsDownloaded(
      downloadedData,
      FileType.PLAIN,
      expectedFilename,
    );
  }

  public async assertJpgFileIsDownloaded(
    downloadedData: UploadDownloadData,
    expectedFilename?: string,
  ) {
    await this.assertFileIsDownloaded(
      downloadedData,
      FileType.JPG,
      expectedFilename,
    );
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
