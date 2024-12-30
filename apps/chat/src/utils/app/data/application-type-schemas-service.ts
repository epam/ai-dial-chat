import { Observable, map } from 'rxjs';

import { HTTPMethod } from '@/src/types/http';

import { ApiUtils } from '../../server/api';

export class ApplicationTypesSchemasService {
  public static getApplicationTypesSchemas(): Observable<any[]> {
    return ApiUtils.request('/api/application-type-schemas/schemas', {
      method: HTTPMethod.GET,
    }).pipe(map(({ schemas }: any) => schemas));
  }

  public static getApplicationTypeSchema(id: string): Observable<any> {
    return ApiUtils.request('/api/application/types/schema/details', {
      method: HTTPMethod.POST,
      body: JSON.stringify({ id }),
    });
  }
}
