import { Observable, map } from 'rxjs';

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
} from '@/src/types/common';
import { FolderInterface } from '@/src/types/folder';
import { EntityStorage } from '@/src/types/storage';

import { DataService } from '../data-service';
import { constructPath } from './../../file';

export abstract class ApiEntityStorage<
  EntityInfo extends { folderId?: string },
  Entity extends EntityInfo,
> implements EntityStorage<EntityInfo, Entity>
{
  getFolders(path?: string | undefined): Observable<FolderInterface[]> {
    const filter = BackendDataNodeType.FOLDER;

    const query = new URLSearchParams({
      filter,
      bucket: DataService.getBucket(),
      ...(path && { path }),
    });
    const resultQuery = query.toString();

    return ApiUtils.request(
      `api/${this.getStorageKey()}/listing?${resultQuery}`,
    ).pipe(
      map((folders: BackendChatFolder[]) => {
        return folders.map((folder): FolderInterface => {
          const relativePath = folder.parentPath || undefined;

          return {
            id: constructPath(getParentPath(folder.parentPath), folder.name),
            name: folder.name,
            folderId: relativePath,
            type: getFolderTypeByApiKey(this.getStorageKey()),
          };
        });
      }),
    );
  }
  getEntities(path?: string): Observable<EntityInfo[]> {
    const filter = BackendDataNodeType.ITEM;

    const query = new URLSearchParams({
      filter,
      bucket: DataService.getBucket(),
      ...(path && { path }),
    });
    const resultQuery = query.toString();

    return ApiUtils.request(
      `api/${this.getStorageKey()}/listing?${resultQuery}`,
    ).pipe(
      map((entities: BackendChatEntity[]) => {
        return entities.map((entity): EntityInfo => {
          const relativePath = entity.parentPath || undefined;
          const info = this.parseEntityKey(entity.name);

          return {
            ...info,
            id: constructPath(getParentPath(entity.parentPath), entity.name),
            lastActivityDate: entity.updatedAt + index, // TODO: for some reasons we have several entities with the same time and they changes places on UI
            folderId: relativePath,
          };
        });
      }),
    );
  }
  getEntity(info: EntityInfo): Observable<Entity | null> {
    const key = this.getEntityKey(info);
    return ApiUtils.request(
      `api/${this.getStorageKey()}/${DataService.getBucket()}${getParentPath(
        info.folderId,
      )}/${key}`,
    ).pipe(
      map((entity: Entity) => {
        return {
          ...entity,
          ...info,
        };
      }),
    );
  }
  createEntity(entity: Entity): Observable<void> {
    const key = this.getEntityKey(entity);
    return ApiUtils.request(
      `api/${this.getStorageKey()}/${DataService.getBucket()}${getParentPath(
        entity.folderId,
      )}/${key}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entity),
      },
    );
  }
  updateEntity(entity: Entity): Observable<void> {
    return this.createEntity(entity);
  }
  deleteEntity(info: EntityInfo): Observable<void> {
    const key = this.getEntityKey(info);
    return ApiUtils.request(
      `api/${this.getStorageKey()}/${DataService.getBucket()}${getParentPath(
        info.folderId,
      )}/${key}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  }
  abstract getEntityKey(info: EntityInfo): string;
  abstract parseEntityKey(key: string): EntityInfo;
  abstract getStorageKey(): ApiKeys;
}
