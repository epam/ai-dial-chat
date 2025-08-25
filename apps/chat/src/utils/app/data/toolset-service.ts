import { Observable, catchError, map, of, throwError } from 'rxjs';

import { convertToolsetFromApi } from '@/src/utils/app/toolsets';
import { ApiUtils, getOpsApiUrl } from '@/src/utils/server/api';

import { HTTPMethod } from '@/src/types/http';
import { ServerSlugs } from '@/src/types/slugs-types';
import {
  ToolsetAuthPayload,
  ToolsetAuthPayloadBase,
  ToolsetModel,
} from '@/src/types/toolsets';

import { Toolset } from '@epam/ai-dial-shared';

export class ToolsetService {
  public static getToolsets(): Observable<ToolsetModel[]> {
    return ApiUtils.request('/api/toolsets/listing', {
      method: HTTPMethod.GET,
    }).pipe(
      map((res) => res.data.map(convertToolsetFromApi)),
      catchError(() => of([])),
    );
  }

  public static getToolsetByPath(path: string): Observable<ToolsetModel> {
    return ApiUtils.request(`/api/toolsets/${path}`, {
      method: HTTPMethod.GET,
    }).pipe(
      map(convertToolsetFromApi),
      catchError((err) => {
        console.error('Failed to get toolset', err);
        return throwError(() => new Error(err.message));
      }),
    );
  }

  public static deleteToolset(path: string): Observable<void> {
    return ApiUtils.request(`/api/toolsets/${path}`, {
      method: HTTPMethod.DELETE,
    });
  }

  public static saveToolset(data: Toolset, path: string): Observable<void> {
    return ApiUtils.request(`/api/toolsets/${path}`, {
      method: HTTPMethod.PUT,
      body: JSON.stringify(data),
    });
  }

  public static signIn(data: ToolsetAuthPayload): Observable<void> {
    return ApiUtils.request(getOpsApiUrl(ServerSlugs.TOOLSET_SIGN_IN), {
      method: HTTPMethod.POST,
      body: JSON.stringify(data),
    });
  }

  public static signOut(data: ToolsetAuthPayloadBase): Observable<void> {
    return ApiUtils.request(getOpsApiUrl(ServerSlugs.TOOLSET_SIGN_OUT), {
      method: HTTPMethod.POST,
      body: JSON.stringify(data),
    });
  }
}
