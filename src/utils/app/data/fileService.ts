import { Observable, map } from 'rxjs';

import { BackendDataNodeType } from '@/src/types/common';
import {
  BackendFile,
  BackendFileFolder,
  DialFile,
  FileFolderInterface,
} from '@/src/types/files';
import { FolderType } from '@/src/types/folder';

import { ApiKeys } from '../../server/api';
import { constructPath } from '../file';
import { ApiStorage } from './storages/api-storage';

export class FileService {
  public static sendFile(
    formData: FormData,
    bucket: string,
    relativePath: string | undefined,
    fileName: string,
  ): Observable<{ percent?: number; result?: DialFile }> {
    const resultPath = encodeURI(
      `files/${bucket}/${relativePath ? `${relativePath}/` : ''}${fileName}`,
    );

    return ApiStorage.requestOld({
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
              id: constructPath(relativePath, typedResult.name),
              name: typedResult.name,
              absolutePath: constructPath(
                'files',
                typedResult.bucket,
                relativePath,
              ),
              relativePath: relativePath,
              folderId: relativePath,
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
    bucket: string,
    parentPath?: string,
  ): Observable<FileFolderInterface[]> {
    const filter = BackendDataNodeType.FOLDER;

    const query = new URLSearchParams({
      filter,
      bucket,
      ...(parentPath && { path: parentPath }),
    });
    const resultQuery = query.toString();

    return ApiStorage.request(
      `api/${ApiKeys.Files}/listing?${resultQuery}`,
    ).pipe(
      map((folders: BackendFileFolder[]) => {
        return folders.map((folder): FileFolderInterface => {
          const relativePath = folder.parentPath || undefined;

          return {
            id: constructPath(relativePath, folder.name),
            name: folder.name,
            type: FolderType.File,
            absolutePath: constructPath(ApiKeys.Files, bucket, relativePath),
            relativePath: relativePath,
            folderId: relativePath,
            serverSynced: true,
          };
        });
      }),
    );
  }

  public static removeFile(bucket: string, filePath: string): Observable<void> {
    const resultPath = encodeURI(constructPath('files', bucket, filePath));

    return ApiStorage.request(`api/${ApiKeys.Files}/${resultPath}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  public static getFiles(
    bucket: string,
    parentPath?: string,
  ): Observable<DialFile[]> {
    const filter = BackendDataNodeType.ITEM;

    const query = new URLSearchParams({
      filter,
      bucket,
      ...(parentPath && { path: parentPath }),
    });
    const resultQuery = query.toString();

    return ApiStorage.request(
      `api/${ApiKeys.Files}/listing?${resultQuery}`,
    ).pipe(
      map((files: BackendFile[]) => {
        return files.map((file): DialFile => {
          const relativePath = file.parentPath || undefined;

          return {
            id: constructPath(relativePath, file.name),
            name: file.name,
            absolutePath: constructPath(
              ApiKeys.Files,
              file.bucket,
              relativePath,
            ),
            relativePath: relativePath,
            folderId: relativePath,
            contentLength: file.contentLength,
            contentType: file.contentType,
            serverSynced: true,
          };
        });
      }),
    );
  }
}
