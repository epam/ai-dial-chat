import { BackendDataEntity, BackendDataNodeType } from '@/chat/types/common';
import { BackendFile } from '@/chat/types/files';
import { API, Attachment } from '@/src/testData';
import { BaseApiHelper } from '@/src/testData/api/baseApiHelper';
import { BucketUtil, ItemUtil } from '@/src/utils';
import { expect } from '@playwright/test';
import * as fs from 'fs';
import path from 'path';

export class FileApiHelper extends BaseApiHelper {
  public async putFile(filename: string, parentPath?: string) {
    const encodedFilename = encodeURIComponent(filename);
    const encodedParentPath = parentPath
      ? parentPath.split('/').map(encodeURIComponent).join('/')
      : undefined;
    const filePath = path.join(Attachment.attachmentPath, filename);
    const bufferedFile = fs.readFileSync(filePath);
    const baseUrl = `${API.fileHost}/${BucketUtil.getBucket()}`;
    const url = parentPath
      ? `${baseUrl}/${encodedParentPath}/${encodedFilename}`
      : `${baseUrl}/${encodedFilename}`;
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
    expect(
      response.status(),
      `File ${filename} was uploaded to path: ${parentPath}`,
    ).toBe(200);
    const responseText = await response.text();
    const body = JSON.parse(responseText) as BackendFile & { url: string };
    return decodeURIComponent(body.url);
  }

  public async deleteFromAllFiles(path: string) {
    const url = `/api/${path}`;
    const response = await this.request.delete(url);
    expect(response.status(), `File by path: ${path} was deleted`).toBe(200);
  }

  public async deleteFromSharedWithMe(path: string) {
    const encodedPath = ItemUtil.getEncodedItemId(path);
    const url = API.discardShareWithMeItem;
    const requestData = {
      resources: [{ url: encodedPath }],
    };
    const response = await this.request.post(url, {
      data: requestData,
    });
    expect(
      response.status(),
      `File by path: ${path} was deleted from "Shared with me"`,
    ).toBe(200);
  }

  public async listEntities(nodeType: BackendDataNodeType, url?: string) {
    const host = url
      ? `${API.listingHost}/${url.substring(0, url.length - 1)}`
      : `${API.filesListingHost()}/${BucketUtil.getBucket()}`;
    const response = await this.request.get(host, {
      params: {
        filter: nodeType,
      },
    });
    const statusCode = response.status();
    expect(
      statusCode,
      `Received response code: ${statusCode} with body: ${await response.text()}`,
    ).toBe(200);
    return (await response.json()) as BackendDataEntity[];
  }

  public async deleteAllFiles(url?: string) {
    const folders = await this.listEntities(BackendDataNodeType.FOLDER, url);
    const files = await this.listEntities(BackendDataNodeType.ITEM, url);
    for (const file of files) {
      await this.deleteFromAllFiles(file.url);
    }
    for (const folder of folders) {
      await this.deleteAllFiles(folder.url);
    }
  }

  public static getContentTypeForFile(filename: string) {
    const extension = filename.match(/(?<=\.)[^.]+$/g);
    if (extension) {
      switch (extension[0]) {
        case 'png':
          return 'image/png';
        case 'jpg':
        case 'jpeg':
          return 'image/jpeg';
        case 'gif':
          return 'image/gif';
        case 'webp':
          return 'image/webp';
        case 'json':
          return 'application/vnd.plotly.v1+json';
        case 'pdf':
          return 'application/pdf';
        default:
          return 'text/plain';
      }
    } else {
      return 'application/octet-stream'; // Default to generic binary type
    }
  }
  public static extractFilename(filePath: string) {
    const lastSlashIndex = filePath.lastIndexOf('/');
    return lastSlashIndex !== -1
      ? filePath.substring(lastSlashIndex + 1)
      : filePath;
  }
}
