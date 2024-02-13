import { EMPTY, Observable, catchError, map, of } from 'rxjs';

import {
  ApiKeys,
  ApiUtils,
  getFolderTypeByApiKey,
} from '@/src/utils/server/api';

import {
  BackendChatEntity,
  BackendChatFolder,
  BackendDataNodeType,
  Entity,
  UploadStatus,
} from '@/src/types/common';
import { FolderInterface, FoldersAndEntities } from '@/src/types/folder';
import { EntityStorage } from '@/src/types/storage';

import { constructPath } from '../../../file';
import { splitEntityId } from '../../../folders';
import { BucketService } from '../../bucket-service';

export abstract class ApiEntityStorage<
  TEntityInfo extends Entity,
  TEntity extends TEntityInfo,
> implements EntityStorage<TEntityInfo, TEntity>
{
  private mapFolder(folder: BackendChatFolder): FolderInterface {
    const id = decodeURI(folder.url.slice(0, folder.url.length - 1));
    const { apiKey, bucket, parentPath } = splitEntityId(id);

    return {
      id,
      name: folder.name,
      folderId: constructPath(apiKey, bucket, parentPath),
      type: getFolderTypeByApiKey(this.getStorageKey()),
    };
  }

  private mapEntity(entity: BackendChatEntity): TEntityInfo {
    const info = this.parseEntityKey(entity.name);
    const id = decodeURI(entity.url);
    const { apiKey, bucket, parentPath } = splitEntityId(id);

    return {
      ...info,
      id,
      lastActivityDate: entity.updatedAt,
      folderId: constructPath(apiKey, bucket, parentPath),
    } as unknown as TEntityInfo;
  }

  private encodePath = (path: string): string =>
    constructPath(...path.split('/').map((part) => encodeURIComponent(part)));

  private getEntityUrl = (entity: TEntityInfo): string =>
    this.encodePath(constructPath('api', entity.id));

  private getListingUrl = (resultQuery: string): string => {
    const listingUrl = this.encodePath(
      constructPath('api', this.getStorageKey(), 'listing'),
    );
    return `${listingUrl}?${resultQuery}`;
  };

  getFoldersAndEntities(
    path?: string | undefined,
  ): Observable<FoldersAndEntities<TEntityInfo>> {
    const query = new URLSearchParams({
      bucket: BucketService.getBucket(),
      ...(path && { path }),
    });
    const resultQuery = query.toString();

    return ApiUtils.request(this.getListingUrl(resultQuery)).pipe(
      map((items: (BackendChatFolder | BackendChatEntity)[]) => {
        const folders = items.filter(
          (item) => item.nodeType === BackendDataNodeType.FOLDER,
        ) as BackendChatFolder[];
        const entities = items.filter(
          (item) => item.nodeType === BackendDataNodeType.ITEM,
        ) as BackendChatEntity[];

        return {
          entities: entities.map((entity) => this.mapEntity(entity)),
          folders: folders.map((folder) => this.mapFolder(folder)),
        };
      }),
      catchError(() =>
        of({
          entities: [],
          folders: [],
        }),
      ), // TODO: handle error it in https://github.com/epam/ai-dial-chat/issues/663
    );
  }

  getFolders(path?: string | undefined): Observable<FolderInterface[]> {
    const filter = BackendDataNodeType.FOLDER;

    const query = new URLSearchParams({
      filter,
      bucket: BucketService.getBucket(),
      ...(path && { path }),
    });
    const resultQuery = query.toString();

    return ApiUtils.request(this.getListingUrl(resultQuery)).pipe(
      map((folders: BackendChatFolder[]) => {
        return folders.map((folder) => this.mapFolder(folder));
      }),
      catchError(() => of([])), // TODO: handle error it in https://github.com/epam/ai-dial-chat/issues/663
    );
  }

  getEntities(path?: string, recursive?: boolean): Observable<TEntityInfo[]> {
    const filter = BackendDataNodeType.ITEM;

    const query = new URLSearchParams({
      filter,
      bucket: BucketService.getBucket(),
      ...(path && { path }),
      ...(recursive && { recursive: String(recursive) }),
    });
    const resultQuery = query.toString();

    return ApiUtils.request(this.getListingUrl(resultQuery)).pipe(
      map((entities: BackendChatEntity[]) => {
        return entities.map((entity) => this.mapEntity(entity));
      }),
      catchError(() => of([])), // TODO: handle error it in https://github.com/epam/ai-dial-chat/issues/663
    );
  }

  getEntity(info: TEntityInfo): Observable<TEntity | null> {
    return ApiUtils.request(this.getEntityUrl(info)).pipe(
      map((entity: TEntity) => {
        return {
          ...this.mergeGetResult(info, entity),
          status: UploadStatus.LOADED,
        };
      }),
      catchError(() => of(null)), // TODO: handle error it in https://github.com/epam/ai-dial-chat/issues/663
    );
  }

  createEntity(entity: TEntity): Observable<void> {
    return ApiUtils.request(this.getEntityUrl(entity), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(this.cleanUpEntity(entity)),
    }).pipe(catchError(() => of())); // TODO: handle error it in https://github.com/epam/ai-dial-chat/issues/663
  }

  updateEntity(entity: TEntity): Observable<void> {
    return ApiUtils.request(this.getEntityUrl(entity), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(this.cleanUpEntity(entity)),
    }).pipe(catchError(() => EMPTY)); // TODO: handle error it in https://github.com/epam/ai-dial-chat/issues/663
  }

  deleteEntity(info: TEntityInfo): Observable<void> {
    return ApiUtils.request(this.getEntityUrl(info), {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    }).pipe(catchError(() => EMPTY)); // TODO: handle error it in https://github.com/epam/ai-dial-chat/issues/663
  }

  abstract getEntityKey(info: TEntityInfo): string;

  abstract parseEntityKey(key: string): Omit<TEntityInfo, 'folderId'>;

  abstract getStorageKey(): ApiKeys;

  abstract cleanUpEntity(entity: TEntity): TEntity;

  abstract mergeGetResult(info: TEntityInfo, entity: TEntity): TEntity;
}
