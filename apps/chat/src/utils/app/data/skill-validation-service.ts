import { Observable, from, switchMap, throwError } from 'rxjs';
import { fromFetch } from 'rxjs/fetch';

import { ApiUtils } from '@/src/utils/server/api';

export interface SkillValidationResult {
  valid: boolean;
  message?: string;
}

export class SkillValidationService {
  public static validate(
    deploymentId: string,
    url: string,
  ): Observable<SkillValidationResult> {
    return fromFetch('/api/skill-validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deploymentId: ApiUtils.encodeApiUrl(deploymentId),
        url: ApiUtils.encodeApiUrl(url),
      }),
    }).pipe(
      switchMap((response) => {
        if (!response.ok) {
          return throwError(() => response);
        }
        return from(response.json() as Promise<SkillValidationResult>);
      }),
    );
  }
}
