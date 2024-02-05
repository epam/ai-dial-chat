import { BackendFile } from '@/chat/types/files';
import { API, Attachment } from '@/src/testData';
import { BaseApiHelper } from '@/src/testData/api/baseApiHelper';
import { BucketUtil } from '@/src/utils';
import * as fs from 'fs';
import path from 'path';

export class FileApiHelper extends BaseApiHelper {
  public async putFile(filename: string) {
    const filePath = path.join(Attachment.attachmentPath, filename);
    const bufferedFile = fs.readFileSync(filePath);
    const url = `${API.uploadedFileHost()}/${BucketUtil.getBucket()}/${filename}`;
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
    const body = JSON.parse(responseText) as BackendFile & { url: string };
    return body.url;
  }

  public async deleteUploadedFile(filename: string) {
    const url = `${API.uploadedFileHost()}/${BucketUtil.getBucket()}/${filename}`;
    await this.request.delete(url);
  }

  public async deleteAppDataFile(filename: string) {
    const url = `${API.fileHost}/${filename}`;
    await this.request.delete(url);
  }

  public static getContentTypeForFile(filename: string) {
    const extension = filename.match(/(?<=\.).+$/g);
    switch (extension![0]) {
      case 'png':
        return 'image/png';
      case 'jpg':
        return 'image/jpeg';
      default:
        return 'text/plain';
    }
  }
}
