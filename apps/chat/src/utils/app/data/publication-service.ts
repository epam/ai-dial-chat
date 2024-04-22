import { Observable } from 'rxjs';

import { BackendResourceType } from '@/src/types/common';
import {
  Publication,
  PublicationRequest,
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
      body: JSON.stringify(publicationData),
    });
  }

  public static publicationList(
    url: string,
  ): Observable<PublicationsListModel> {
    return ApiUtils.request('api/publication/listing', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  }

  public static getPublication(url: string): Observable<Publication> {
    return ApiUtils.request('api/publication/details', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  }

  public static deletePublication(url: string): Observable<void> {
    return ApiUtils.request('api/publication/delete', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  }

  public static getPublishedConversations(
    parentPath: string,
    options?: Partial<{ recursive: boolean }>,
  ): Observable<PublishedItem[]> {
    const query = new URLSearchParams({
      ...(parentPath && { parentPath: parentPath }),
      ...(options?.recursive && { recursive: String(options.recursive) }),
    });
    const resultQuery = query.toString();
    return ApiUtils.request(`api/publication/publishedListing?${resultQuery}`);
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
      body: JSON.stringify({ url }),
    });
  }

  public static rejectPublication(url: string): Observable<Publication> {
    return ApiUtils.request('api/publication/reject', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  }
}
