import { Observable, map } from 'rxjs';

import { BackendResourceType, FeatureType } from '@/src/types/common';
import {
  Publication,
  PublicationInfo,
  PublicationRequestModel,
  PublicationRule,
  PublicationsListModel,
  PublishedByMeItem,
  PublishedItem,
} from '@/src/types/publication';

import { PUBLIC_URL_PREFIX } from '@/src/constants/public';

import { ApiUtils } from '../../server/api';
import { constructPath } from '../file';
import { EnumMapper } from '../mappers';

import mapKeys from 'lodash-es/mapKeys';

export class PublicationService {
  public static publish(
    publicationData: PublicationRequestModel,
  ): Observable<Publication> {
    return ApiUtils.request('api/publication/create', {
      method: 'POST',
      body: JSON.stringify(publicationData),
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
    name: string;
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
    featureType: FeatureType,
    options?: Partial<{ recursive: boolean }>,
  ): Observable<PublishedItem> {
    const query = new URLSearchParams({
      ...(options?.recursive && { recursive: String(options.recursive) }),
    });
    const resultQuery = query.toString();
    return ApiUtils.request(`
      ${constructPath(
        'api',
        'publication',
        EnumMapper.getApiKeyByFeatureType(featureType),
        PUBLIC_URL_PREFIX,
        ApiUtils.encodeApiUrl(parentPath),
      )}${resultQuery ? `?${resultQuery}` : ''}`);
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
  ): Observable<Record<string, PublicationRule[]>> {
    return ApiUtils.request('api/publication/rulesList', {
      method: 'POST',
      body: JSON.stringify({
        url: `${ApiUtils.encodeApiUrl(
          path ? constructPath(PUBLIC_URL_PREFIX, path) : PUBLIC_URL_PREFIX,
        )}/`,
      }),
    }).pipe(
      map(({ rules }: { rules: Record<string, PublicationRule[]> }) =>
        mapKeys(rules, (_, key) => ApiUtils.decodeApiUrl(key)),
      ),
    );
  }
}
