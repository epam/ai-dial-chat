import { Observable, catchError, map, of } from 'rxjs';

import { ApiUtils } from '@/src/utils/server/api';

import {
  ApiApplicationTypeSchema,
  ApiDetailedApplicationTypeSchema,
  ApplicationTypeSchema,
} from '@/src/types/application-type-schema';
import { HTTPMethod } from '@/src/types/http';

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
      // TODO: handle error
      catchError(() => of([])),
    );
  }

  public static getApplicationTypeSchema(
    id: string,
  ): Observable<ApiDetailedApplicationTypeSchema> {
    return ApiUtils.request(`/api/application-type-schemas/schema?id=${id}`, {
      method: HTTPMethod.GET,
    });
  }
}
