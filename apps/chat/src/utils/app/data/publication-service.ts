import { Observable, map } from 'rxjs';

import { ApiKeys, BackendResourceType } from '@/src/types/common';
import {
  Publication,
  PublicationInfo,
  PublicationRequest,
  PublicationRule,
  PublicationsListModel,
  PublishedByMeItem,
  PublishedItem,
} from '@/src/types/publication';

import { ApiUtils } from '../../server/api';

export class PublicationService {
  public static publish(
    publicationData: PublicationRequest,
  ): Observable<Publication> {
    return ApiUtils.request('api/publication/create', {
      method: 'POST',
      body: JSON.stringify({
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
          if (!p.targetFolder) return p;

          return {
            ...p,
            targetFolder: ApiUtils.decodeApiUrl(p.targetFolder),
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
          reviewUrl: r.reviewUrl
            ? ApiUtils.decodeApiUrl(r.reviewUrl)
            : ApiUtils.decodeApiUrl(r.targetUrl),
          sourceUrl: r.sourceUrl ? ApiUtils.decodeApiUrl(r.sourceUrl) : null,
        }));

        if (!publication.targetFolder) {
          return {
            ...publication,
            resources: decodedResources,
          };
        }

        return {
          ...publication,
          targetFolder: ApiUtils.decodeApiUrl(publication.targetFolder),
          targetUrl: ApiUtils.decodeApiUrl(publication.targetFolder),
          resources: decodedResources,
        };
      }),
    );
  }

  public static deletePublication(data: {
    targetFolder: string;
    resources: { targetUrl: string }[];
  }): Observable<void> {
    return ApiUtils.request('api/publication/create', {
      method: 'POST',
      body: JSON.stringify(data),
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
      `api/publication/${entityType}/public/${ApiUtils.encodeApiUrl(parentPath)}?${resultQuery}`,
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

  public static getRules(
    path: string,
  ): Observable<{ rules: Record<string, PublicationRule[]> }> {
    return ApiUtils.request('api/publication/rulesList', {
      method: 'POST',
      body: JSON.stringify({
        url: ApiUtils.encodeApiUrl(path ? `public/${path}/` : `public/`),
      }),
    });
  }
}
