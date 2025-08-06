import { Observable, catchError, map, of } from 'rxjs';

import { convertToolsetFromApi } from '@/src/utils/app/toolsets';
import { ApiUtils } from '@/src/utils/server/api';

import { HTTPMethod } from '@/src/types/http';
import { ToolsetModel } from '@/src/types/toolsets';

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

  public static getToolset(toolId: string): Observable<ToolsetModel | null> {
    return ApiUtils.request(`/api/toolsets/listing/${toolId}`, {
      method: HTTPMethod.GET,
    }).pipe(
      map(convertToolsetFromApi),
      catchError(() => of(null)),
    );
  }

  public static getToolsetByPath(
    path: string,
  ): Observable<ToolsetModel | null> {
    return ApiUtils.request(`/api/toolsets/${path}`, {
      method: HTTPMethod.GET,
    }).pipe(
      map(convertToolsetFromApi),
      catchError(() => of(null)),
    );
  }

  public static deleteToolset(path: string): Observable<void> {
    return ApiUtils.request(`/api/toolsets/${path}`, {
      method: HTTPMethod.DELETE,
    });
  }

  public static addToolset(data: Toolset, path: string): Observable<void> {
    return ApiUtils.request(`/api/toolsets/${path}`, {
      method: HTTPMethod.PUT,
      body: JSON.stringify(data),
    });
  }
}
