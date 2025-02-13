import Router from 'next/router';

import { of } from 'rxjs';
import { catchError, filter, switchMap } from 'rxjs/operators';

import { combineEpics } from 'redux-observable';

import { ApplicationTypesSchemasService } from '@/src/utils/app/data/application-type-schemas-service';

import { AppEpic } from '@/src/types/store';

import {
  ApplicationTypesSchemasActions,
  ApplicationTypesSchemasSelectors,
} from './applicationTypeSchemas.reducer';

import { UploadStatus } from '@epam/ai-dial-shared';

const fetchSchemasEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(
      (action) =>
        ApplicationTypesSchemasActions.init.match(action) &&
        ApplicationTypesSchemasSelectors.selectSchemasLoading(state$.value) !==
          UploadStatus.LOADED,
    ),
    switchMap(() => {
      return ApplicationTypesSchemasService.getApplicationTypesSchemas().pipe(
        switchMap((schemas) =>
          of(
            ApplicationTypesSchemasActions.fetchSchemasSuccess({ schemas }),
            ApplicationTypesSchemasActions.initFinish(),
          ),
        ),
        catchError(() => of(ApplicationTypesSchemasActions.fetchSchemasFail())),
      );
    }),
  );

const fetchDetailedApplicationTypeSchemaEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(
      (action) =>
        ApplicationTypesSchemasActions.fetchDetailedApplicationTypeSchema.match(
          action,
        ) || ApplicationTypesSchemasActions.initFinish.match(action),
    ),
    switchMap(({ payload }) => {
      let id = payload;

      if (!id) {
        const slug = Router?.query?.slug?.toString();
        if (slug) {
          const schemas = ApplicationTypesSchemasSelectors.selectAllSchemas(
            state$.value,
          );
          const schema = schemas.find(
            (schema) =>
              schema.id.replace(/^https?:\/\//, '') ===
              decodeURIComponent(slug),
          );
          id = schema?.id;
        }
      }
      if (!id)
        return of(
          ApplicationTypesSchemasActions.fetchDetailedApplicationTypeSchemaFail(),
        );

      return ApplicationTypesSchemasService.getApplicationTypeSchema(id).pipe(
        switchMap((schema) =>
          of(
            ApplicationTypesSchemasActions.fetchDetailedApplicationTypeSchemaSuccess(
              { schema },
            ),
          ),
        ),
        catchError(() =>
          of(
            ApplicationTypesSchemasActions.fetchDetailedApplicationTypeSchemaFail(),
          ),
        ),
      );
    }),
  );

export const ApplicationTypesSchemasEpics = combineEpics(
  fetchSchemasEpic,
  fetchDetailedApplicationTypeSchemaEpic,
);
