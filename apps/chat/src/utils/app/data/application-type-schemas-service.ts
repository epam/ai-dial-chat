import { Observable, catchError, map, of } from 'rxjs';

import {
  ApiApplicationTypeSchema,
  ApplicationTypeSchema,
} from '@/src/types/application-type-chema';
import { HTTPMethod } from '@/src/types/http';

import { ApiUtils } from '../../server/api';
import { convertApplicationTypeSchemaFromApi } from '../application-type-schema';

export class ApplicationTypesSchemasService {
  public static getApplicationTypesSchemas(): Observable<
    ApplicationTypeSchema[]
  > {
    return ApiUtils.request('/api/application-type-schemas/schemas', {
      method: HTTPMethod.GET,
    }).pipe(
      map((response) =>
        Array.isArray(response)
          ? response.map((schema: ApiApplicationTypeSchema) =>
              convertApplicationTypeSchemaFromApi(schema),
            )
          : [],
      ),
      catchError(() => of([])),
    );
  }

  public static getApplicationTypeSchema(id: string): Observable<any> {
    return ApiUtils.request('/api/application/types/schema/details', {
      method: HTTPMethod.POST,
      body: JSON.stringify({ id }),
    });
  }
}
