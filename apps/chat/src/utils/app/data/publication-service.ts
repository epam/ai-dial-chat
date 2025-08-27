import { Observable, map } from 'rxjs';

import { ApiUtils, getOpsApiUrl } from '@/src/utils/server/api';

import { BackendDataNodeType, FeatureType } from '@/src/types/common';
import { HTTPMethod } from '@/src/types/http';
import {
  BasePublicationRequestModel,
  Publication,
  PublicationInfo,
  PublicationRequestModel,
  PublicationRule,
  PublicationUpdateRequestModel,
  PublicationsListModel,
  PublishedFileItem,
  PublishedItem,
} from '@/src/types/publication';
import { ServerSlugs } from '@/src/types/slugs-types';

import { PUBLIC_URL_PREFIX } from '@/src/constants/publication';

import { constructPath } from '../file';
import { EnumMapper } from '../mappers';

import mapKeys from 'lodash-es/mapKeys';

const prepareBasePublicationDataTargetFolder = (
  publicationData: BasePublicationRequestModel,
): BasePublicationRequestModel => {
  const encodedTargetFolder = ApiUtils.encodeApiUrl(
    publicationData.targetFolder,
  );
  const targetFolderSuffix = publicationData.targetFolder ? '/' : '';

  return {
    targetFolder: `${encodedTargetFolder}${targetFolderSuffix}`,
    displayAuthor: publicationData.displayAuthor,
    rules: publicationData.rules,
  };
};

const preparePublicationCreateData = (
  publicationData: PublicationRequestModel,
): PublicationRequestModel => {
  return {
    name: publicationData.name,
    resources: publicationData.resources.map((r) => ({
      action: r.action,
      sourceUrl: r.sourceUrl ? ApiUtils.encodeApiUrl(r.sourceUrl) : undefined,
      targetUrl: ApiUtils.encodeApiUrl(r.targetUrl),
    })),
    ...prepareBasePublicationDataTargetFolder(publicationData),
  };
};

const preparePublicationUpdateData = (
  publicationData: PublicationUpdateRequestModel,
): PublicationUpdateRequestModel => {
  return {
    resources: publicationData.resources.map((r) => ({
      action: r.action,
      sourceUrl: ApiUtils.encodeApiUrl(r.sourceUrl),
      targetUrl: ApiUtils.encodeApiUrl(r.targetUrl),
    })),
    ...prepareBasePublicationDataTargetFolder(publicationData),
  };
};

export class PublicationService {
  public static createPublicationRequest(
    publicationData: PublicationRequestModel,
  ): Observable<Publication> {
    return ApiUtils.request(getOpsApiUrl(ServerSlugs.PUBLICATION_CREATE), {
      method: HTTPMethod.POST,
      body: JSON.stringify(preparePublicationCreateData(publicationData)),
    });
  }

  public static updatePublicationRequest({
    publicationData,
    url,
  }: {
    publicationData: PublicationUpdateRequestModel;
    url: string;
  }): Observable<Publication> {
    return ApiUtils.request(getOpsApiUrl(ServerSlugs.PUBLICATION_UPDATE), {
      method: HTTPMethod.POST,
      body: JSON.stringify({
        ...preparePublicationUpdateData(publicationData),
        url: ApiUtils.encodeApiUrl(url),
      }),
    });
  }

  public static publicationList(): Observable<PublicationInfo[]> {
    return ApiUtils.request(getOpsApiUrl(ServerSlugs.PUBLICATION_LIST), {
      method: HTTPMethod.POST,
      body: JSON.stringify({
        url: 'publications/public/',
      }),
    }).pipe(
      map(({ publications }: PublicationsListModel) => {
        return publications.map((publication) => {
          if (!publication.targetFolder) return publication;

          return {
            ...publication,
            targetFolder: ApiUtils.decodeApiUrl(publication.targetFolder),
          };
        });
      }),
    );
  }

  public static getPublication(url: string): Observable<Publication> {
    return ApiUtils.request(getOpsApiUrl(ServerSlugs.PUBLICATION_GET), {
      method: HTTPMethod.POST,
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

  public static getPublishedWithMeItems(
    parentPath: string,
    featureType: FeatureType,
    options?: Partial<{ recursive: boolean }>,
  ): Observable<{
    folders: PublishedItem[];
    items: PublishedItem[] | PublishedFileItem[];
  }> {
    const query = new URLSearchParams({
      ...(options?.recursive && { recursive: String(options.recursive) }),
    });
    const resultQuery = query.toString();
    return ApiUtils.request(
      `
      ${constructPath(
        'api',
        'publication',
        EnumMapper.getApiKeyByFeatureType(featureType),
        PUBLIC_URL_PREFIX,
        ApiUtils.encodeApiUrl(parentPath),
      )}${resultQuery ? `?${resultQuery}` : ''}`,
    ).pipe(
      map((publications: PublishedItem) => {
        if (!publications.items) {
          return {
            folders: [],
            items: [],
          };
        }

        const mappedPublicationItems = publications.items.map((item) => ({
          ...item,
          url: ApiUtils.decodeApiUrl(item.url),
        }));

        return {
          folders: mappedPublicationItems.filter(
            (item) => item.nodeType === BackendDataNodeType.FOLDER,
          ),
          items: mappedPublicationItems.filter(
            (item) => item.nodeType === BackendDataNodeType.ITEM,
          ),
        };
      }),
    );
  }

  public static approvePublication(url: string): Observable<Publication> {
    return ApiUtils.request(getOpsApiUrl(ServerSlugs.PUBLICATION_APPROVE), {
      method: HTTPMethod.POST,
      body: JSON.stringify({ url: ApiUtils.encodeApiUrl(url) }),
    });
  }

  public static rejectPublication(url: string): Observable<Publication> {
    return ApiUtils.request(getOpsApiUrl(ServerSlugs.PUBLICATION_REJECT), {
      method: HTTPMethod.POST,
      body: JSON.stringify({ url: ApiUtils.encodeApiUrl(url) }),
    });
  }

  public static getRules(
    path: string,
  ): Observable<Record<string, PublicationRule[]>> {
    return ApiUtils.request(getOpsApiUrl(ServerSlugs.PUBLICATION_RULE_LIST), {
      method: HTTPMethod.POST,
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
