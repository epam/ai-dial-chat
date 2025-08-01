import { Observable, catchError, map, of } from 'rxjs';

import { ApiUtils } from '@/src/utils/server/api';

import { HTTPMethod } from '@/src/types/http';

import { Toolset } from '@epam/ai-dial-shared';

export class ToolsetService {
  public static getToolsets(): Observable<Toolset[]> {
    return ApiUtils.request('/api/toolsets/listing', {
      method: HTTPMethod.GET,
    }).pipe(
      map((res) => res.data),
      catchError(() => of([])),
    );
  }

  public static getToolset(toolId: string): Observable<Toolset | null> {
    return ApiUtils.request(`/api/toolsets/listing/${toolId}`, {
      method: HTTPMethod.GET,
    }).pipe(catchError(() => of(null)));
  }
}
