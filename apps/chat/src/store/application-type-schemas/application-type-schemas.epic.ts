import { of } from 'rxjs';
import { catchError, filter, switchMap } from 'rxjs/operators';

import { combineEpics } from 'redux-observable';

import { ApplicationTypesSchemasService } from '@/src/utils/app/data/application-type-schemas-service';

import { AppEpic } from '@/src/types/store';

import { ApplicationTypesSchemasActions } from './application-type-schemas.reducer';

const fetchSchemasEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ApplicationTypesSchemasActions.init.match),
    switchMap(() =>
      ApplicationTypesSchemasService.getApplicationTypesSchemas().pipe(
        switchMap((schemas) =>
          of(
            ApplicationTypesSchemasActions.fetchSchemasSuccess({ schemas }),
            ApplicationTypesSchemasActions.initFinish(),
          ),
        ),
        catchError(() => of(ApplicationTypesSchemasActions.fetchSchemasFail())),
      ),
    ),
  );

export const ApplicationTypesSchemasEpics = combineEpics(fetchSchemasEpic);
