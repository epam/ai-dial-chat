import { BackendFile } from '@/src/types/files';

import { API, Attachment } from '@/e2e/src/testData';
import { BaseApiHelper } from '@/e2e/src/testData/api/baseApiHelper';
import { BucketUtil } from '@/e2e/src/utils';
import * as fs from 'fs';
import path from 'path';

export class FileApiHelper extends BaseApiHelper {
  public async putFile(filename: string) {
    const filePath = path.join(Attachment.attachmentPath, filename);
    const bufferedFile = fs.readFileSync(filePath);
    const url = `${API.fileHost}/${BucketUtil.getBucket()}/${filename}`;
    const response = await this.request.put(url, {
      headers: {
        Accept: '*/*',
        ContentType: 'multipart/form-data',
      },
      multipart: {
        file: {
          name: filename,
          mimeType: FileApiHelper.getContentTypeForFile(filename)!,
          buffer: bufferedFile,
        },
      },
    });
    const responseText = await response.text();
    console.log('Upload response: ' + responseText);
    const body = JSON.parse(responseText) as BackendFile & { url: string };
    return body.url;
  }

  public async getFiles() {
    const response = await this.request.get(API.filesListingHost, {
      params: { filter: 'ITEM', bucket: BucketUtil.getBucket() },
    });
    const responseText = await response.text();
    console.log('Get files: ' + responseText);
  }

  public async deleteFile(filename: string) {
    const url = `${API.fileHost}/${BucketUtil.getBucket()}/${filename}`;
    await this.request.delete(url);
    console.log('Delete file!');
  }

  public static getContentTypeForFile(filename: string) {
    const extension = filename.match(/(?<=\.).+$/g);
    switch (extension![0]) {
      case 'png':
        return 'image/png';
      case 'jpg':
        return 'image/jpeg';
    }
  }
}
