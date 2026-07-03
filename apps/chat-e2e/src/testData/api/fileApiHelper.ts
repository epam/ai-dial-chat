import { BackendDataEntity, BackendDataNodeType } from '@/chat/types/common';
import { BackendFile } from '@/chat/types/files';
import { DialAIEntityModel } from '@/chat/types/models';
import { Publication } from '@/chat/types/publication';
import { API, Attachment, ExpectedConstants } from '@/src/testData';
import { BaseApiHelper } from '@/src/testData/api/baseApiHelper';
import { BucketUtil, ItemUtil } from '@/src/utils';
import { PublishActions, Toolset } from '@epam/ai-dial-shared';
import { expect } from '@playwright/test';
import * as fs from 'fs';
import path from 'path';

export class FileApiHelper extends BaseApiHelper {
  private async putFileGeneric(
    buffer: Buffer,
    filename: string,
    options?: { parentPath?: string; optionalBucket?: string },
  ) {
    const encodedFilename = encodeURIComponent(filename);
    const parentPath = options?.parentPath;
    const encodedParentPath = parentPath
      ? ItemUtil.getEncodedItemId(parentPath)
      : undefined;

    const bucket =
      options?.optionalBucket ?? this.userBucket ?? BucketUtil.getBucket();
    const baseUrl = `${API.fileHost()}/${bucket}`;
    const url = parentPath
      ? `${baseUrl}/${encodedParentPath}/${encodedFilename}`
      : `${baseUrl}/${encodedFilename}`;

    const response = await this.request.put(this.getHost(url), {
      headers: {
        Accept: '*/*',
        ContentType: 'multipart/form-data',
      },
      multipart: {
        file: {
          name: filename,
          mimeType: FileApiHelper.getContentTypeForFile(filename)!,
          buffer: buffer,
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

  public async putFile(
    filename: string,
    options?: { parentPath?: string; optionalBucket?: string },
  ) {
    return this.putFileWithCustomName(filename, filename, options);
  }

  public async putFileWithCustomName(
    filename: string,
    file: string,
    options?: { parentPath?: string; optionalBucket?: string },
  ) {
    const filePath = path.join(Attachment.attachmentPath, file);
    const buffer = fs.readFileSync(filePath);
    return this.putFileGeneric(buffer, filename, options);
  }

  public async putStringAsFile(
    filename: string,
    content: string,
    options?: { parentPath?: string; optionalBucket?: string },
  ) {
    const buffer = Buffer.from(content, 'utf-8');
    return this.putFileGeneric(buffer, filename, options);
  }

  public async putFileToPublicationBucket(
    publication: Publication,
    sourceFileUrl: string,
  ) {
    const filename = FileApiHelper.extractFilename(sourceFileUrl);
    const targetFileUrl = `files/public/${filename}`;

    const resources = [
      ...(publication.resources ?? []),
      {
        action: PublishActions.ADD_IF_ABSENT,
        sourceUrl: sourceFileUrl,
        targetUrl: targetFileUrl,
      },
    ];

    const requestData = {
      url: publication.url,
      resources: resources,
      targetFolder: ExpectedConstants.rootPublicationFolder,
      displayAuthor: publication.displayAuthor ?? '',
      rules: [],
    };

    const response = await this.request.post(
      this.getHost(API.publicationUpdate),
      {
        data: requestData,
      },
    );

    expect(
      response.status(),
      `File ${sourceFileUrl} was put to publication bucket for publication ${publication.url}. Status: ${response.status()}`,
    ).toBe(200);
  }

  public async updateInstalledDeployments(agents: DialAIEntityModel[]) {
    const installedDeployments = agents.map((agent) => ({
      id: agent.reference ?? agent.id,
    }));
    const installedDeploymentsJson = JSON.stringify(installedDeployments);
    await this.putStringAsFile(
      API.installedDeploymentsFile,
      installedDeploymentsJson,
      { parentPath: API.installedEntityFolder },
    );
  }

  // Bookmarks toolsets for the user — installed_toolsets.json holds their references.
  public async updateInstalledToolsets(toolsets: Toolset[]) {
    const installedToolsets = toolsets.map((t) => t.reference ?? t.id);
    await this.putStringAsFile(
      API.installedToolsetsFile,
      JSON.stringify(installedToolsets),
      { parentPath: API.installedEntityFolder },
    );
  }

  public async getFile(filePath: string) {
    const baseUrl = `${API.fileHost()}/${this.userBucket ?? BucketUtil.getBucket()}`;
    const url = `${baseUrl}/${filePath}`;
    const response = await this.request.get(this.getHost(url));
    expect(response.status()).toBe(200);
    return response;
  }

  public async deleteFromAllFiles(path: string) {
    const url = `/api/${path}`;
    const response = await this.request.delete(this.getHost(url));
    expect(response.status(), `File by path: ${path} was deleted`).toBe(200);
  }

  public async deleteFromSharedWithMe(path: string) {
    const encodedPath = ItemUtil.getEncodedItemId(path);
    const url = API.discardShareWithMeItem;
    const requestData = {
      resources: [{ url: encodedPath }],
    };
    const response = await this.request.post(this.getHost(url), {
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
      : `${API.filesListingHost()}/${this.userBucket ?? BucketUtil.getBucket()}`;
    const response = await this.request.get(this.getHost(host), {
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
        case 'svg':
          return 'image/svg+xml';
        case 'mp3':
          return 'audio/mpeg';
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
