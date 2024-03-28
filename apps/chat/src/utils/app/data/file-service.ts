import { Observable, map } from 'rxjs';

import { ApiKeys, BackendDataNodeType } from '@/src/types/common';
import {
  BackendFile,
  BackendFileFolder,
  DialFile,
  FileFolderInterface,
} from '@/src/types/files';
import { FolderType } from '@/src/types/folder';

import { ApiUtils } from '../../server/api';
import { constructPath } from '../file';
import { getRootId } from '../id';

export class FileService {
  public static sendFile(
    formData: FormData,
    relativePath: string | undefined,
    fileName: string,
  ): Observable<{ percent?: number; result?: DialFile }> {
    const resultPath = ApiUtils.encodeApiUrl(
      constructPath(getRootId(), relativePath, fileName),
    );

    return ApiUtils.requestOld({
      url: `api/${resultPath}`,
      method: 'POST',
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
      constructPath('/api/listing', path || getRootId()),
    );
    return resultQuery ? `/${listingUrl}?${resultQuery}` : listingUrl;
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
        return folders.map((folder): FileFolderInterface => {
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
            type: FolderType.File,
            absolutePath: constructPath(
              ApiKeys.Files,
              folder.bucket,
              relativePath,
            ),
            relativePath: relativePath,
            folderId: constructPath(
              getRootId({ bucket: folder.bucket }),
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
      method: 'DELETE',
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
        return files.map((file): DialFile => {
          const relativePath = file.parentPath
            ? ApiUtils.decodeApiUrl(file.parentPath)
            : undefined;

          return {
            id: constructPath(
              ApiKeys.Files,
              file.bucket,
              relativePath,
              file.name,
            ),
            name: file.name,
            absolutePath: constructPath(
              ApiKeys.Files,
              file.bucket,
              relativePath,
            ),
            relativePath: relativePath,
            folderId: constructPath(
              getRootId({ bucket: file.bucket }),
              relativePath,
            ),
            contentLength: file.contentLength,
            contentType: file.contentType,
            serverSynced: true,
          };
        });
      }),
    );
  }

  public static getFileContent<T>(path: string): Observable<T> {
    return ApiUtils.request(`/${ApiUtils.encodeApiUrl(path)}`);
  }
}
