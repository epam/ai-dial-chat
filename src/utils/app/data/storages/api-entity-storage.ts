import { Observable, map } from 'rxjs';

import { ApiUtils } from '@/src/utils/server/api';

import { BackendChatEntity, BackendDataNodeType } from '@/src/types/common';
import { EntityStorage } from '@/src/types/storage';

import { DataService } from '../data-service';

export abstract class ApiEntityStorage<EntityInfo, Entity extends EntityInfo>
  implements EntityStorage<EntityInfo, Entity>
{
  getEntities(path?: string | undefined): Observable<EntityInfo[]> {
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
      map((conversations: BackendChatEntity[]) => {
        return conversations.map((conversation): EntityInfo => {
          const relativePath = conversation.parentPath || undefined;
          const info = this.parseEntityKey(conversation.name);

          return {
            ...info,
            folderId: relativePath,
          };
        });
      }),
    );
  }
  getEntity(info: EntityInfo): Observable<Entity> {
    const key = this.getEntityKey(info);
    return ApiUtils.request(
      `api/${this.getStorageKey()}/${DataService.getBucket()}/${key}`,
    ).pipe(
      map((entity: Entity) => {
        return {
          ...info,
          ...entity,
          uploaded: true,
        };
      }),
    );
  }
  createEntity(entity: Entity): Observable<void> {
    const key = this.getEntityKey(entity);
    return ApiUtils.request(
      `api/${this.getStorageKey()}/${DataService.getBucket()}/${key}`,
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
      `api/${this.getStorageKey()}/${DataService.getBucket()}/${key}`,
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
  abstract getStorageKey(): string;
}
