import { Observable, map } from 'rxjs';

import { DataService } from '@/src/utils/app/data/data-service';
import { getDownloadName } from '@/src/utils/app/import-export';
import { ApiUtils } from '@/src/utils/server/api';

import {
  ApiKeys,
  BackendChatEntity,
  BackendDataNodeType,
  FeatureType,
  MoveModel,
} from '@/src/types/common';
import {
  BackendFile,
  BackendFileFolder,
  DialFile,
  FileFolderInterface,
  FileOperationsResult,
} from '@/src/types/files';
import { HTTPMethod } from '@/src/types/http';

import { CLIENTDATA_PATH } from '@/src/constants/client-data';
import { FALLBACK_CONTENT_TYPE } from '@/src/constants/file';
import { PUBLIC_URL_PREFIX } from '@/src/constants/publication';

import { constructPath, getMimeTypeByFileName } from '../file';
import { getFileRootId } from '../id';
import { BucketService } from './bucket-service';

import {
  DialCopiedItem,
  DialDeletedItem,
  DialFileNodeType,
  DialFile as UIKitDialFile,
} from '@epam/ai-dial-ui-kit';
import { saveAs } from 'file-saver';

const fixContentType = (file: BackendFile): string => {
  if (file.contentType !== FALLBACK_CONTENT_TYPE) {
    return file.contentType;
  }

  return getMimeTypeByFileName(file.name);
};

const mapFileToDial = (file: BackendFile): DialFile => {
  const relativePath = file.parentPath; // parentPath comes from core already decoded
  const userBucket = BucketService.getBucket();

  return {
    id: constructPath(ApiKeys.Files, file.bucket, relativePath, file.name),
    name: file.name,
    absolutePath: constructPath(ApiKeys.Files, file.bucket, relativePath),
    relativePath: relativePath,
    folderId: constructPath(getFileRootId(file.bucket), relativePath),
    contentLength: file.contentLength,
    contentType: fixContentType(file),
    serverSynced: true,
    updatedAt: file.updatedAt,
    permissions: file.permissions,
    sharedWithMe:
      file.bucket !== userBucket && file.bucket !== PUBLIC_URL_PREFIX,
  };
};

export class FileService {
  public static sendFile(
    formData: FormData,
    relativePath: string | undefined,
    fileName: string,
    httpMethod?: HTTPMethod,
    bucket?: string,
    options?: { signal?: AbortSignal | null },
  ): Observable<{ percent?: number; result?: DialFile }> {
    const resultPath = ApiUtils.encodeApiUrl(
      constructPath(getFileRootId(bucket), relativePath, fileName),
    );

    return ApiUtils.requestOld({
      url: `/api/${resultPath}`,
      method: httpMethod ? httpMethod : HTTPMethod.POST,
      async: true,
      body: formData,
      signal: options?.signal,
    }).pipe(
      map(
        ({
          percent,
          result,
        }: {
          percent?: number;
          result?: unknown;
        }): { percent?: number; result?: DialFile } => {
          if (percent) {
            return { percent };
          }

          if (!result) {
            return {};
          }

          const typedResult = result as BackendFile;
          const relativePath = typedResult.parentPath
            ? ApiUtils.decodeApiUrl(typedResult.parentPath)
            : undefined;

          return {
            result: {
              id: ApiUtils.decodeApiUrl(typedResult.url),
              name: typedResult.name,
              absolutePath: constructPath(
                ApiKeys.Files,
                typedResult.bucket,
                relativePath,
              ),
              relativePath: relativePath,
              folderId: constructPath(
                ApiKeys.Files,
                typedResult.bucket,
                relativePath,
              ),
              contentLength: typedResult.contentLength,
              contentType: typedResult.contentType,
              serverSynced: true,
              updatedAt: typedResult.updatedAt,
            },
          };
        },
      ),
    );
  }

  private static getListingUrl = ({
    path,
    resultQuery,
  }: {
    path?: string;
    resultQuery?: string;
  }): string => {
    const listingUrl = ApiUtils.encodeApiUrl(
      constructPath('/api/listing', path || getFileRootId()),
    );
    return resultQuery ? `${listingUrl}?${resultQuery}` : listingUrl;
  };

  private static getFullListingUrl = ({
    path,
    resultQuery,
  }: {
    path?: string;
    resultQuery?: string;
  }): string => {
    const listingUrl = ApiUtils.encodeApiUrl(
      constructPath('/api/file-manager', path || getFileRootId()),
    );
    return resultQuery ? `${listingUrl}?${resultQuery}` : listingUrl;
  };

  public static getFileFolders(
    parentPath?: string,
  ): Observable<FileFolderInterface[]> {
    const filter = BackendDataNodeType.FOLDER;

    const query = new URLSearchParams({
      filter,
    });
    const resultQuery = query.toString();

    return ApiUtils.request(
      this.getListingUrl({ path: parentPath, resultQuery }),
    ).pipe(
      map((folders: BackendFileFolder[]) => {
        return folders
          .filter(
            (folder) => !!folder.parentPath || folder.name !== CLIENTDATA_PATH,
          )
          .map((folder): FileFolderInterface => {
            const relativePath = folder.parentPath
              ? ApiUtils.decodeApiUrl(folder.parentPath)
              : undefined;

            return {
              id: constructPath(
                ApiKeys.Files,
                folder.bucket,
                relativePath,
                folder.name,
              ),
              name: folder.name,
              type: FeatureType.File,
              absolutePath: constructPath(
                ApiKeys.Files,
                folder.bucket,
                relativePath,
              ),
              relativePath: relativePath,
              folderId: constructPath(
                getFileRootId(folder.bucket),
                relativePath,
              ),
              serverSynced: true,
              permissions: folder.permissions,
            };
          });
      }),
    );
  }

  public static deleteFile(filePath: string): Observable<void> {
    return ApiUtils.request(`/api/${ApiUtils.encodeApiUrl(filePath)}`, {
      method: HTTPMethod.DELETE,
    });
  }

  public static getFiles(folderId?: string): Observable<DialFile[]> {
    const filter = BackendDataNodeType.ITEM;

    const query = new URLSearchParams({
      filter,
    });
    const resultQuery = query.toString();

    return ApiUtils.request(
      this.getListingUrl({ path: folderId, resultQuery }),
    ).pipe(
      map((files: BackendFile[]) => {
        return files.map(mapFileToDial);
      }),
    );
  }

  public static getMultipleFoldersFiles(
    paths: string[],
    recursive?: boolean,
  ): Observable<DialFile[]> {
    const query = new URLSearchParams({
      recursive: String(!!recursive),
    });
    const resultQuery = query.toString();

    return ApiUtils.request(`/api/listing/multiple?${resultQuery}`, {
      method: HTTPMethod.POST,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        urls: paths.map((path) => ApiUtils.encodeApiUrl(path)),
      }),
    }).pipe(map((files) => files.map(mapFileToDial)));
  }

  public static getFullListing(folderPath?: string): Observable<DialFile[]> {
    const query = new URLSearchParams({
      recursive: 'true',
      filter: BackendDataNodeType.ITEM,
      permissions: 'true',
    });
    const resultQuery = query.toString();

    return ApiUtils.request(
      this.getFullListingUrl({ path: folderPath, resultQuery }),
    ).pipe(
      map((files: BackendFile[]) => {
        return files.map(mapFileToDial);
      }),
    );
  }

  public static getFileContent<T>(path: string): Observable<T> {
    return ApiUtils.request(path);
  }

  public static getFileMetadata(
    fileId: string,
  ): Observable<UIKitDialFile | null> {
    return ApiUtils.request(
      `/api/metadata/${ApiUtils.encodeApiUrl(fileId)}`,
    ).pipe(
      map((metadata: BackendChatEntity) => {
        const relativePath = metadata.parentPath
          ? ApiUtils.decodeApiUrl(metadata.parentPath)
          : undefined;

        const decodedUrl = ApiUtils.decodeApiUrl(metadata.url);

        const uiKitFile: UIKitDialFile = {
          ...metadata,
          nodeType: DialFileNodeType.ITEM,
          resourceType:
            metadata.resourceType as unknown as UIKitDialFile['resourceType'],
          path: metadata.url,
          folderId: constructPath(getFileRootId(metadata.bucket), relativePath),
          id: decodedUrl,
          permissions: metadata.permissions as UIKitDialFile['permissions'],
          createdAt: metadata.createdAt
            ? new Date(metadata.createdAt).toISOString()
            : undefined,
          updatedAt: metadata.updatedAt
            ? new Date(metadata.updatedAt).toISOString()
            : undefined,
        };

        return uiKitFile;
      }),
    );
  }

  public static moveFile(moveModel: MoveModel): Observable<MoveModel> {
    return DataService.getDataStorage().move(moveModel);
  }

  public static copyFiles(
    data: {
      files: DialCopiedItem[];
    },
    options?: { signal?: AbortSignal | null },
  ): Observable<FileOperationsResult<MoveModel>> {
    return DataService.getDataStorage().copyFiles(data, options);
  }

  public static moveFiles(
    data: {
      files: DialCopiedItem[];
    },
    options?: { signal?: AbortSignal | null },
  ): Observable<FileOperationsResult<MoveModel>> {
    return DataService.getDataStorage().moveFiles(data, options);
  }

  public static deleteFiles(data: {
    files: DialDeletedItem[];
  }): Observable<FileOperationsResult<string>> {
    return DataService.getDataStorage().deleteFiles(data);
  }

  public static async downloadFilesAsArchive(
    files: UIKitDialFile[],
    name?: string,
  ): Promise<void> {
    try {
      const archiveName = getDownloadName({
        name,
        exportType: 'files',
        extension: 'zip',
      });

      const response = await fetch('/api/files/download', {
        method: HTTPMethod.POST,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ files }),
      });

      if (!response.ok) {
        throw new Error('Failed to download files');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const chunks: Uint8Array[] = [];

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
        }
      }

      const size = chunks.reduce((s, c) => s + c.byteLength, 0);
      const merged = new Uint8Array(size);
      let offset = 0;
      for (const c of chunks) {
        merged.set(c, offset);
        offset += c.byteLength;
      }

      const contentType =
        response.headers.get('content-type') ?? 'application/zip';

      const blob = new Blob([merged.buffer as ArrayBuffer], {
        type: contentType,
      });
      saveAs(blob, archiveName);
    } catch (error) {
      throw new Error(`Error downloading files: ${error}`);
    }
  }

  public static uploadArchive(data: {
    file: File;
    destinationUrl: string;
  }): Observable<void> {
    return DataService.getDataStorage().uploadArchive(data);
  }
}
