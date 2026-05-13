import Router from 'next/router';

import { of } from 'rxjs';
import { catchError, filter, switchMap } from 'rxjs/operators';

import { combineEpics, ofType } from 'redux-observable';

import { cleanSchemaId } from '@/src/utils/app/application-type-schema';
import { ApplicationTypesSchemasService } from '@/src/utils/app/data/application-type-schemas-service';
import { parseApiError } from '@/src/utils/app/epics-helpers/common.epic-helpers';

import { AppEpic } from '@/src/types/store';

import { ApplicationTypesSchemasActions } from '@/src/store/actions';
import { ApplicationTypesSchemasSelectors } from '@/src/store/selectors';

import { UploadStatus } from '@epam/ai-dial-shared';

const fetchSchemasEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ApplicationTypesSchemasActions.init.type),
    filter(
      () =>
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
        catchError((err) => {
          const { traceId } = parseApiError(err);
          return of(
            ApplicationTypesSchemasActions.fetchSchemasFail({ traceId }),
          );
        }),
      );
    }),
  );

const fetchDetailedApplicationTypeSchemaEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(
      ApplicationTypesSchemasActions.fetchDetailedApplicationTypeSchema.type,
      ApplicationTypesSchemasActions.initFinish.type,
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
            (schema) => cleanSchemaId(schema.id) === decodeURIComponent(slug),
          );
          id = schema?.id;
        }
      }
      if (!id) {
        return of(
          ApplicationTypesSchemasActions.fetchDetailedApplicationTypeSchemaFail(),
        );
      }

      return ApplicationTypesSchemasService.getApplicationTypeSchema(id).pipe(
        switchMap((schema) =>
          of(
            ApplicationTypesSchemasActions.fetchDetailedApplicationTypeSchemaSuccess(
              { schema },
            ),
          ),
        ),
        catchError((err) => {
          const { traceId } = parseApiError(err);
          return of(
            ApplicationTypesSchemasActions.fetchDetailedApplicationTypeSchemaFail(
              { traceId },
            ),
          );
        }),
      );
    }),
  );

export const ApplicationTypesSchemasEpics = combineEpics(
  fetchSchemasEpic,
  fetchDetailedApplicationTypeSchemaEpic,
);
