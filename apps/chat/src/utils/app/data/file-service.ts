import { Observable, map } from 'rxjs';

import { DataService } from '@/src/utils/app/data/data-service';
import { ApiUtils } from '@/src/utils/server/api';

import {
  ApiKeys,
  BackendDataNodeType,
  FeatureType,
  MoveModel,
} from '@/src/types/common';
import {
  BackendFile,
  BackendFileFolder,
  DialFile,
  FileFolderInterface,
} from '@/src/types/files';
import { HTTPMethod } from '@/src/types/http';

import { CLIENTDATA_PATH } from '@/src/constants/client-data';

import { constructPath } from '../file';
import { getFileRootId } from '../id';

import {
  DialCopiedItem,
  DialDeletedItem,
  DialFile as UIKitDialFile,
} from '@epam/ai-dial-ui-kit';
import { saveAs } from 'file-saver';

const mapFileToDial = (file: BackendFile): DialFile => {
  const relativePath = file.parentPath
    ? ApiUtils.decodeApiUrl(file.parentPath)
    : undefined;

  return {
    id: constructPath(ApiKeys.Files, file.bucket, relativePath, file.name),
    name: file.name,
    absolutePath: constructPath(ApiKeys.Files, file.bucket, relativePath),
    relativePath: relativePath,
    folderId: constructPath(getFileRootId(file.bucket), relativePath),
    contentLength: file.contentLength,
    contentType: file.contentType,
    serverSynced: true,
    updatedAt: file.updatedAt,
  };
};

export class FileService {
  public static sendFile(
    formData: FormData,
    relativePath: string | undefined,
    fileName: string,
    httpMethod?: HTTPMethod,
    bucket?: string,
  ): Observable<{ percent?: number; result?: DialFile }> {
    const resultPath = ApiUtils.encodeApiUrl(
      constructPath(getFileRootId(bucket), relativePath, fileName),
    );

    return ApiUtils.requestOld({
      url: `/api/${resultPath}`,
      method: httpMethod ? httpMethod : HTTPMethod.POST,
      async: true,
      body: formData,
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

  public static getFileContent<T>(path: string): Observable<T> {
    return ApiUtils.request(path);
  }

  public static moveFile(moveModel: MoveModel): Observable<MoveModel> {
    return DataService.getDataStorage().move(moveModel);
  }

  public static copyFiles(data: {
    files: DialCopiedItem[];
  }): Observable<MoveModel[]> {
    return DataService.getDataStorage().copyFiles(data);
  }

  public static moveFiles(data: {
    files: DialCopiedItem[];
  }): Observable<MoveModel[]> {
    return DataService.getDataStorage().moveFiles(data);
  }

  public static deleteFiles(data: {
    files: DialDeletedItem[];
  }): Observable<void> {
    return DataService.getDataStorage().deleteFiles(data);
  }

  public static async downloadFilesAsArchive(
    files: UIKitDialFile[],
  ): Promise<void> {
    try {
      const archiveName = files.length === 1 ? files[0].name : 'files';

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
      saveAs(blob, `${archiveName}.zip`);
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
