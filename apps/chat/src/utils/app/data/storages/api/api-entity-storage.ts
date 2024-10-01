import { Observable, map, throwError } from 'rxjs';

import { ApiUtils } from '@/src/utils/server/api';

import {
  ApiKeys,
  BackendChatEntity,
  BackendChatFolder,
  BackendDataNodeType,
} from '@/src/types/common';
import { FolderInterface, FoldersAndEntities } from '@/src/types/folder';
import { HTTPMethod } from '@/src/types/http';
import { EntityStorage } from '@/src/types/storage';

import { constructPath } from '../../../file';
import { splitEntityId } from '../../../folders';
import { getRootId } from '../../../id';
import { EnumMapper } from '../../../mappers';

import { Entity, UploadStatus } from '@epam/ai-dial-shared';

export abstract class ApiEntityStorage<
  TEntityInfo extends Entity,
  TEntity extends TEntityInfo,
  APIResponse = TEntity,
  APIModel = APIResponse,
> implements EntityStorage<TEntityInfo, TEntity>
{
  private mapFolder(folder: BackendChatFolder): FolderInterface {
    const id = ApiUtils.decodeApiUrl(
      folder.url.slice(0, folder.url.length - 1),
    );
    const { apiKey, bucket, parentPath } = splitEntityId(id);

    return {
      id,
      name: folder.name,
      folderId: constructPath(apiKey, bucket, parentPath),
      type: EnumMapper.getFolderTypeByApiKey(this.getStorageKey()),
    };
  }

  private mapEntity(entity: BackendChatEntity): TEntityInfo {
    const info = this.parseEntityKey(entity.name);
    const id = ApiUtils.decodeApiUrl(entity.url);
    const { apiKey, bucket, parentPath } = splitEntityId(id);

    return {
      ...info,
      id,
      lastActivityDate: entity.updatedAt,
      folderId: constructPath(apiKey, bucket, parentPath),
    } as unknown as TEntityInfo;
  }

  private getEntityUrl = (entity: TEntityInfo): string =>
    ApiUtils.encodeApiUrl(constructPath('api', entity.id));

  private getListingUrl = ({
    path,
    resultQuery,
  }: {
    path?: string;
    resultQuery?: string;
  }): string => {
    const listingUrl = ApiUtils.encodeApiUrl(
      constructPath(
        'api/listing',
        path ||
          getRootId({
            featureType: EnumMapper.getFeatureTypeByApiKey(
              this.getStorageKey(),
            ),
          }),
      ),
    );
    return resultQuery ? `${listingUrl}?${resultQuery}` : listingUrl;
  };

  getFoldersAndEntities(
    path?: string,
  ): Observable<FoldersAndEntities<TEntityInfo>> {
    return ApiUtils.request(this.getListingUrl({ path })).pipe(
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
    );
  }

  getFolders(path?: string): Observable<FolderInterface[]> {
    const filter = BackendDataNodeType.FOLDER;

    const query = new URLSearchParams({
      filter,
    });
    const resultQuery = query.toString();

    return ApiUtils.request(this.getListingUrl({ path, resultQuery })).pipe(
      map((folders: BackendChatFolder[]) => {
        return folders.map((folder) => this.mapFolder(folder));
      }),
    );
  }

  getEntities(path?: string, recursive?: boolean): Observable<TEntityInfo[]> {
    const filter = BackendDataNodeType.ITEM;

    const query = new URLSearchParams({
      filter,
      ...(recursive && { recursive: String(recursive) }),
    });
    const resultQuery = query.toString();

    return ApiUtils.request(this.getListingUrl({ path, resultQuery })).pipe(
      map((entities: BackendChatEntity[]) => {
        return entities.map((entity) => this.mapEntity(entity));
      }),
    );
  }

  getEntity(info: TEntityInfo): Observable<TEntity | null> {
    try {
      return ApiUtils.request(this.getEntityUrl(info)).pipe(
        map((entity: APIResponse) => {
          return {
            ...this.mergeGetResult(info, entity),
            status: UploadStatus.LOADED,
          };
        }),
      );
    } catch (error) {
      return throwError(() => error);
    }
  }

  createEntity(entity: TEntity): Observable<TEntityInfo> {
    try {
      return ApiUtils.request(this.getEntityUrl(entity), {
        method: HTTPMethod.POST,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(this.cleanUpEntity(entity)),
      }).pipe(map((entity) => this.mapEntity(entity)));
    } catch (error) {
      return throwError(() => error);
    }
  }

  updateEntity(entity: TEntity): Observable<void> {
    try {
      return ApiUtils.request(this.getEntityUrl(entity), {
        method: HTTPMethod.PUT,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(this.cleanUpEntity(entity)),
      });
    } catch (error) {
      return throwError(() => error);
    }
  }

  deleteEntity(info: TEntityInfo): Observable<void> {
    try {
      return ApiUtils.request(this.getEntityUrl(info), {
        method: HTTPMethod.DELETE,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      return throwError(() => error);
    }
  }

  abstract getEntityKey(info: TEntityInfo): string;

  abstract parseEntityKey(key: string): Omit<TEntityInfo, 'folderId' | 'id'>;

  abstract getStorageKey(): ApiKeys;

  abstract cleanUpEntity(entity: TEntity): APIModel;

  abstract mergeGetResult(info: TEntityInfo, entity: APIResponse): TEntity;
}
