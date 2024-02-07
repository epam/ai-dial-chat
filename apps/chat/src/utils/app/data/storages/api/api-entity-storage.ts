import { EMPTY, Observable, catchError, map, of } from 'rxjs';

import {
  ApiKeys,
  ApiUtils,
  getFolderTypeByApiKey,
  getParentPath,
} from '@/src/utils/server/api';

import {
  BackendChatEntity,
  BackendChatFolder,
  BackendDataNodeType,
  UploadStatus,
} from '@/src/types/common';
import { FolderInterface, FoldersAndEntities } from '@/src/types/folder';
import { EntityStorage } from '@/src/types/storage';

import { constructPath } from '../../../file';
import { BucketService } from '../../bucket-service';

export abstract class ApiEntityStorage<
  EntityInfo extends { folderId?: string },
  Entity extends EntityInfo,
> implements EntityStorage<EntityInfo, Entity>
{
  private mapFolder(folder: BackendChatFolder): FolderInterface {
    const relativePath = folder.parentPath || undefined;

    return {
      id: constructPath(folder.parentPath, folder.name),
      name: folder.name,
      folderId: relativePath,
      type: getFolderTypeByApiKey(this.getStorageKey()),
    };
  }

  private mapEntity(entity: BackendChatEntity) {
    const relativePath = entity.parentPath || undefined;
    const info = this.parseEntityKey(entity.name);

    return {
      ...info,
      id: constructPath(entity.parentPath, entity.name),
      lastActivityDate: entity.updatedAt,
      folderId: relativePath,
    };
  }

  getFoldersAndEntities(
    path?: string | undefined,
  ): Observable<FoldersAndEntities<EntityInfo>> {
    const query = new URLSearchParams({
      bucket: BucketService.getBucket(),
      ...(path && { path }),
    });
    const resultQuery = query.toString();

    return ApiUtils.request(
      `api/${this.getStorageKey()}/listing?${resultQuery}`,
    ).pipe(
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
      ),
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

    return ApiUtils.request(
      `api/${this.getStorageKey()}/listing?${resultQuery}`,
    ).pipe(
      map((folders: BackendChatFolder[]) => {
        return folders.map((folder) => this.mapFolder(folder));
      }),
      catchError(() => of([])),
    );
  }

  getEntities(path?: string, recursive?: boolean): Observable<EntityInfo[]> {
    const filter = BackendDataNodeType.ITEM;

    const query = new URLSearchParams({
      filter,
      bucket: BucketService.getBucket(),
      ...(path && { path }),
      ...(recursive && { recursive: String(recursive) }),
    });
    const resultQuery = query.toString();

    return ApiUtils.request(
      `api/${this.getStorageKey()}/listing?${resultQuery}`,
    ).pipe(
      map((entities: BackendChatEntity[]) => {
        return entities.map((entity) => this.mapEntity(entity));
      }),
      catchError(() => of([])),
    );
  }

  getEntity(info: EntityInfo): Observable<Entity | null> {
    const key = this.getEntityKey(info);
    return ApiUtils.request(
      `api/${this.getStorageKey()}/${BucketService.getBucket()}${getParentPath(
        info.folderId,
      )}/${key}`,
    ).pipe(
      map((entity: Entity) => {
        return {
          ...entity,
          ...info,
          status: UploadStatus.LOADED,
        };
      }),
      catchError(() => of(null)),
    );
  }

  createEntity(entity: Entity): Observable<void> {
    const key = this.getEntityKey(entity);
    return ApiUtils.request(
      `api/${this.getStorageKey()}/${BucketService.getBucket()}${getParentPath(
        entity.folderId,
      )}/${key}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(this.cleanUpEntity(entity)),
      },
    ).pipe(catchError(() => EMPTY)); // TODO: handle error
  }

  updateEntity(entity: Entity): Observable<void> {
    return this.createEntity(this.cleanUpEntity(entity));
  }

  deleteEntity(info: EntityInfo): Observable<void> {
    const key = this.getEntityKey(info);
    return ApiUtils.request(
      `api/${this.getStorageKey()}/${BucketService.getBucket()}${getParentPath(
        info.folderId,
      )}/${key}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      },
    ).pipe(catchError(() => EMPTY)); // TODO: handle error
  }

  abstract getEntityKey(info: EntityInfo): string;

  abstract parseEntityKey(key: string): EntityInfo;

  abstract getStorageKey(): ApiKeys;

  abstract cleanUpEntity(entity: Entity): Entity;
}
