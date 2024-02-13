import { Observable, map } from 'rxjs';

import { BackendDataNodeType } from '@/src/types/common';
import {
  BackendFile,
  BackendFileFolder,
  DialFile,
  FileFolderInterface,
} from '@/src/types/files';
import { FolderType } from '@/src/types/folder';

import { ApiKeys, ApiUtils } from '../../server/api';
import { constructPath } from '../file';
import { getRootId } from '../folders';
import { BucketService } from './bucket-service';

export class FileService {
  public static sendFile(
    formData: FormData,
    relativePath: string | undefined,
    fileName: string,
  ): Observable<{ percent?: number; result?: DialFile }> {
    const resultPath = encodeURI(
      constructPath(BucketService.getBucket(), relativePath, fileName),
    );

    return ApiUtils.requestOld({
      url: `api/${ApiKeys.Files}/${resultPath}`,
      method: 'PUT',
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
          const relativePath = typedResult.parentPath || undefined;

          return {
            result: {
              id: decodeURI(typedResult.url),
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

  public static getFileFolders(
    parentPath?: string,
  ): Observable<FileFolderInterface[]> {
    const filter = BackendDataNodeType.FOLDER;

    const query = new URLSearchParams({
      filter,
      bucket: BucketService.getBucket(),
      ...(parentPath && {
        path: parentPath,
      }),
    });
    const resultQuery = query.toString();

    return ApiUtils.request(`api/${ApiKeys.Files}/listing?${resultQuery}`).pipe(
      map((folders: BackendFileFolder[]) => {
        return folders.map((folder): FileFolderInterface => {
          const relativePath = folder.parentPath || undefined;

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
              getRootId({ apiKey: ApiKeys.Files, bucket: folder.bucket }),
              relativePath,
            ),
            serverSynced: true,
          };
        });
      }),
    );
  }

  public static removeFile(filePath: string): Observable<void> {
    const resultPath = encodeURI(
      constructPath(BucketService.getBucket(), filePath),
    );

    return ApiUtils.request(`api/${ApiKeys.Files}/${resultPath}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  public static getFiles(parentPath?: string): Observable<DialFile[]> {
    const filter = BackendDataNodeType.ITEM;

    const query = new URLSearchParams({
      filter,
      bucket: BucketService.getBucket(),
      ...(parentPath && {
        path: parentPath,
      }),
    });
    const resultQuery = query.toString();

    return ApiUtils.request(`api/${ApiKeys.Files}/listing?${resultQuery}`).pipe(
      map((files: BackendFile[]) => {
        return files.map((file): DialFile => {
          const relativePath = file.parentPath || undefined;

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
              getRootId({ apiKey: ApiKeys.Files, bucket: file.bucket }),
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
}
