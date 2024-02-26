import { Observable, map } from 'rxjs';

import {
  ApiKeys,
  ApiUtils,
  decodeApiUrl,
  encodeApiUrl,
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

import { resetShareEntity } from '@/src/constants/chat';

import { constructPath } from '../../../file';
import { splitEntityId } from '../../../folders';
import { getRootId } from '../../../id';
import { EnumMapper } from '../../../mappers';

export abstract class ApiEntityStorage<
  TEntityInfo extends Entity,
  TEntity extends TEntityInfo,
> implements EntityStorage<TEntityInfo, TEntity>
{
  private mapFolder(folder: BackendChatFolder): FolderInterface {
    const id = decodeApiUrl(folder.url.slice(0, folder.url.length - 1));
    const { apiKey, bucket, parentPath } = splitEntityId(id);

    return {
      id,
      name: folder.name,
      folderId: constructPath(apiKey, bucket, parentPath),
      type: EnumMapper.getFolderTypeByApiKey(this.getStorageKey()),
      ...resetShareEntity,
    };
  }

  private mapEntity(entity: BackendChatEntity): TEntityInfo {
    const info = this.parseEntityKey(entity.name);
    const id = decodeApiUrl(entity.url);
    const { apiKey, bucket, parentPath } = splitEntityId(id);

    return {
      ...info,
      id,
      lastActivityDate: entity.updatedAt,
      folderId: constructPath(apiKey, bucket, parentPath),
      ...resetShareEntity,
    } as unknown as TEntityInfo;
  }

  private getEntityUrl = (entity: TEntityInfo): string =>
    encodeApiUrl(constructPath('api', entity.id));

  private getListingUrl = ({
    path,
    resultQuery,
  }: {
    path?: string;
    resultQuery?: string;
  }): string => {
    const listingUrl = encodeApiUrl(
      constructPath(
        'api/listing',
        path || getRootId({ apiKey: this.getStorageKey() }),
      ),
    );
    return resultQuery ? `${listingUrl}?${resultQuery}` : listingUrl;
  };

  getFoldersAndEntities(
    path?: string | undefined,
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

  getFolders(path?: string | undefined): Observable<FolderInterface[]> {
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
    return ApiUtils.request(this.getEntityUrl(info)).pipe(
      map((entity: TEntity) => {
        return {
          ...this.mergeGetResult(info, {
            ...entity,
            ...resetShareEntity,
          }),
          status: UploadStatus.LOADED,
        };
      }),
    );
  }

  createEntity(entity: TEntity): Observable<TEntityInfo> {
    return ApiUtils.request(this.getEntityUrl(entity), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(this.cleanUpEntity(entity)),
    }).pipe(map((entity) => this.mapEntity(entity)));
  }

  updateEntity(entity: TEntity): Observable<void> {
    return ApiUtils.request(this.getEntityUrl(entity), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(this.cleanUpEntity(entity)),
    });
  }

  deleteEntity(info: TEntityInfo): Observable<void> {
    return ApiUtils.request(this.getEntityUrl(info), {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  abstract getEntityKey(info: TEntityInfo): string;

  abstract parseEntityKey(key: string): Omit<TEntityInfo, 'folderId' | 'id'>;

  abstract getStorageKey(): ApiKeys;

  abstract cleanUpEntity(entity: TEntity): TEntity;

  abstract mergeGetResult(info: TEntityInfo, entity: TEntity): TEntity;
}
