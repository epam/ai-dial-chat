import { Observable, map } from 'rxjs';

import { ApiKeys, BackendResourceType } from '@/src/types/common';
import {
  Publication,
  PublicationInfo,
  PublicationRequest,
  PublicationsListModel,
  PublishedByMeItem,
  PublishedItem,
} from '@/src/types/publication';
import { UIStorageKeys } from '@/src/types/storage';

import { ApiUtils } from '../../server/api';
import { BucketService } from './bucket-service';
import { BrowserStorage } from './storages/browser-storage';

export class PublicationService {
  public static publish(
    publicationData: Omit<PublicationRequest, 'url'>,
  ): Observable<Publication> {
    return ApiUtils.request('api/publication/create', {
      method: 'POST',
      body: JSON.stringify({
        url: `publications/${BucketService.getBucket()}/`,
        ...publicationData,
      }),
    });
  }

  public static publicationList(): Observable<PublicationInfo[]> {
    return ApiUtils.request('api/publication/listing', {
      method: 'POST',
      body: JSON.stringify({
        url: 'publications/public/',
      }),
    }).pipe(
      map(({ publications }: PublicationsListModel) => {
        return publications.map((p) => {
          if (!p.targetUrl) return p;

          return {
            ...p,
            targetUrl: ApiUtils.decodeApiUrl(p.targetUrl),
          };
        });
      }),
    );
  }

  public static getPublication(url: string): Observable<Publication> {
    return ApiUtils.request('api/publication/details', {
      method: 'POST',
      body: JSON.stringify({ url: ApiUtils.encodeApiUrl(url) }),
    }).pipe(
      map((publication: Publication) => {
        const decodedResources = publication.resources.map((r) => ({
          ...r,
          targetUrl: ApiUtils.decodeApiUrl(r.targetUrl),
          reviewUrl: r.reviewUrl ? ApiUtils.decodeApiUrl(r.reviewUrl) : null,
          sourceUrl: r.sourceUrl ? ApiUtils.decodeApiUrl(r.sourceUrl) : null,
        }));

        if (!publication.targetUrl) {
          return {
            ...publication,
            resources: decodedResources,
          };
        }

        return {
          ...publication,
          targetUrl: ApiUtils.decodeApiUrl(publication.targetUrl),
          resources: decodedResources,
        };
      }),
    );
  }

  public static deletePublication(
    resources: { targetUrl: string }[],
  ): Observable<void> {
    return ApiUtils.request('api/publication/delete', {
      method: 'POST',
      body: JSON.stringify({
        url: `publications/${BucketService.getBucket()}/`,
        resources: resources.map((r) => ({
          targetUrl: ApiUtils.encodeApiUrl(r.targetUrl),
        })),
      }),
    });
  }

  public static getPublishedWithMeItems(
    parentPath: string,
    entityType: ApiKeys,
    options?: Partial<{ recursive: boolean }>,
  ): Observable<PublishedItem> {
    const query = new URLSearchParams({
      ...(options?.recursive && { recursive: String(options.recursive) }),
    });
    const resultQuery = query.toString();
    return ApiUtils.request(
      `api/publication/${entityType}/public/${parentPath}?${resultQuery}`,
    );
  }

  public static getPublishedByMeItems(
    resourceTypes: BackendResourceType[],
  ): Observable<PublishedByMeItem[]> {
    return ApiUtils.request('api/publication/resourceListing', {
      method: 'POST',
      body: JSON.stringify({ resourceTypes }),
    });
  }

  public static approvePublication(url: string): Observable<Publication> {
    return ApiUtils.request('api/publication/approve', {
      method: 'POST',
      body: JSON.stringify({ url: ApiUtils.encodeApiUrl(url) }),
    });
  }

  public static rejectPublication(url: string): Observable<Publication> {
    return ApiUtils.request('api/publication/reject', {
      method: 'POST',
      body: JSON.stringify({ url: ApiUtils.encodeApiUrl(url) }),
    });
  }

  public static getSelectedConversationsId(): Observable<string | null> {
    return BrowserStorage.getData(UIStorageKeys.SelectedPublicationId, null);
  }

  public static setSelectedPublicationId(
    selectedPublicationId: string,
  ): Observable<void> {
    return BrowserStorage.setData(
      UIStorageKeys.SelectedPublicationId,
      selectedPublicationId,
    );
  }
}
