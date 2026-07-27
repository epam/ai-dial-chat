import { Observable, catchError, map, of } from 'rxjs';

import {
  getIdWithoutFeatureType,
  isPredefinedEntity,
} from '@/src/utils/app/id';
import { convertToolsetFromApi } from '@/src/utils/app/toolsets';
import { ApiUtils, getOpsApiUrl } from '@/src/utils/server/api';

import { HTTPMethod } from '@/src/types/http';
import { ServerSlugs } from '@/src/types/slugs-types';
import {
  ToolsetAuthPayload,
  ToolsetAuthPayloadBase,
  ToolsetInfo,
  ToolsetModel,
  ToolsetTool,
} from '@/src/types/toolsets';

import { DataService } from './data-service';

export class ToolsetService {
  public static getToolsets(): Observable<ToolsetModel[]> {
    return ApiUtils.request('/api/toolsets-listing', {
      method: HTTPMethod.GET,
    }).pipe(
      map((res) => res.data.map(convertToolsetFromApi)),
      catchError(() => of([])),
    );
  }

  public static getToolsetByName(
    name: string,
  ): Observable<ToolsetModel | null> {
    return ApiUtils.request(`/api/toolsets-listing/${name}`, {
      method: HTTPMethod.GET,
    }).pipe(
      map(convertToolsetFromApi),
      catchError(() => of(null)),
    );
  }

  public static getToolsetById(id: string): Observable<ToolsetModel | null> {
    if (isPredefinedEntity({ id })) {
      return ToolsetService.getToolsetByName(id);
    }

    return DataService.getDataStorage().getToolsetById(id);
  }

  public static getToolsetsByPath(path: string): Observable<ToolsetInfo[]> {
    return DataService.getDataStorage().getToolsetsByPath(path);
  }

  public static deleteToolset(id: string): Observable<void> {
    return DataService.getDataStorage().deleteToolset(id);
  }

  public static saveToolset(data: ToolsetModel): Observable<ToolsetInfo> {
    return DataService.getDataStorage().createToolset(data);
  }

  public static updateToolset(data: ToolsetModel): Observable<ToolsetInfo> {
    return DataService.getDataStorage().updateToolset(data);
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

  public static repair(id: string): Observable<void> {
    const path = getIdWithoutFeatureType(id);

    return ApiUtils.request(
      `/api/ops/toolset/${ApiUtils.encodeApiUrl(path)}/repair`,
      {
        method: HTTPMethod.POST,
      },
    );
  }

  public static getTools(id: string): Observable<ToolsetTool[]> {
    return ApiUtils.request(`/api/toolset/${ApiUtils.encodeApiUrl(id)}/tools`, {
      method: HTTPMethod.GET,
    }).pipe(map((res) => res.tools as ToolsetTool[]));
  }
}
