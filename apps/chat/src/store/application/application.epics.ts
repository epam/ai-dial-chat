import { EMPTY, Observable, forkJoin, iif, of } from 'rxjs';
import { catchError, filter, map, switchMap } from 'rxjs/operators';

import { AnyAction } from '@reduxjs/toolkit';

import { combineEpics } from 'redux-observable';

import { ApplicationService } from '@/src/utils/app/data/application-service';
import { translate } from '@/src/utils/app/translation';
import { ApiUtils } from '@/src/utils/server/api';

import {
  CreateApplicationModel,
  DeleteApplicationAction,
} from '@/src/types/applications';
import { EntityType } from '@/src/types/common';

import { UIActions } from '@/src/store/ui/ui.reducers';

import { errorsMessages } from '../../constants/errors';

import { ApplicationActions } from '../application/application.reducers';
import { ModelsActions } from '../models/models.reducers';

const createApplicationEpic = (action$: Observable<AnyAction>) =>
  action$.pipe(
    filter(ApplicationActions.create.match),
    switchMap(
      ({
        payload,
      }: {
        payload: {
          applicationData: CreateApplicationModel;
          applicationName: string;
        };
      }) =>
        ApplicationService.create(
          payload.applicationName,
          payload.applicationData,
        ).pipe(
          switchMap((application) =>
            ApplicationService.getOne(application.url).pipe(
              map((response) => {
                return ModelsActions.addModel({
                  model: {
                    id: ApiUtils.encodeApiUrl(response.name),
                    name: response.display_name,
                    version: response.display_version,
                    description: response.description,
                    iconUrl: response.icon_url,
                    type: EntityType.Application,
                    features: response.features,
                    inputAttachmentTypes: response.input_attachment_types,
                    isDefault: false,
                    maxInputAttachments: response.max_input_attachments,
                    reference: response.reference,
                  },
                });
              }),
            ),
          ),
          catchError((err) => {
            console.error(err);
            return of(ApplicationActions.createFail());
          }),
        ),
    ),
  );

const createFailEpic = (action$: Observable<AnyAction>) =>
  action$.pipe(
    filter(ApplicationActions.createFail.match),
    switchMap(() =>
      of(UIActions.showErrorToast(translate(errorsMessages.createFailed))),
    ),
  );

const deleteApplicationEpic = (action$: Observable<AnyAction>) =>
  action$.pipe(
    filter(ApplicationActions.delete.match),
    switchMap((action: DeleteApplicationAction) =>
      ApplicationService.delete(action.payload).pipe(
        switchMap(() => {
          return of(
            ApplicationActions.deleteSuccess(),
            ModelsActions.deleteModel({ modelId: action.payload }),
          );
        }),
        catchError((err) => {
          console.error(err);
          // Dispatch fail action
          return of(ApplicationActions.deleteFail());
        }),
      ),
    ),
  );

// Fetch listings epic
const listApplicationsEpic = (action$: Observable<AnyAction>) =>
  action$.pipe(
    filter(ApplicationActions.list.match),
    switchMap(() =>
      ApplicationService.listing().pipe(
        switchMap((applications) =>
          of(ApplicationActions.listSuccess(applications)),
        ),
        catchError((err) => {
          console.error(err);
          return of(ApplicationActions.listFail());
        }),
      ),
    ),
  );

// Edit application epic
const editApplicationEpic = (action$: Observable<AnyAction>) =>
  action$.pipe(
    filter(ApplicationActions.edit.match),
    switchMap(
      ({
        payload,
      }: {
        payload: {
          applicationData: CreateApplicationModel;
          oldApplicationName: string;
        };
      }) => {
        const move$ = iif(
          () =>
            payload.oldApplicationName !== payload.applicationData.display_name,
          ApplicationService.move({
            sourceUrl: payload.oldApplicationName,
            destinationUrl: payload.applicationData.display_name,
            overwrite: false,
          }).pipe(
            catchError((err) => {
              console.error('Move failed', err);
              return EMPTY;
            }),
          ),
          of(payload),
        );

        const edit$ = ApplicationService.edit(payload.applicationData).pipe(
          catchError((err) => {
            console.error('Edit failed', err);
            return EMPTY;
          }),
        );

        return forkJoin({
          moveResult: move$,
          editResult: edit$,
        });
      },
    ),
    switchMap(({ editResult }) =>
      ApplicationService.getOne(editResult.url).pipe(
        map((response) => {
          return ModelsActions.updateModel({
            model: {
              id: ApiUtils.encodeApiUrl(response.name),
              name: response.display_name,
              version: response.display_version,
              description: response.description,
              iconUrl: response.icon_url,
              type: EntityType.Application,
              features: response.features,
              inputAttachmentTypes: response.input_attachment_types,
              isDefault: false,
              maxInputAttachments: response.max_input_attachments,
              reference: response.name,
            },
          });
        }),
        catchError((err) => {
          console.error(`Fetch details failed`, err);
          return EMPTY;
        }),
      ),
    ),
  );

const getApplicationEpic = (action$: Observable<AnyAction>) =>
  action$.pipe(
    filter(ApplicationActions.getOne.match),
    switchMap(({ payload }: { payload: string }) =>
      ApplicationService.getOne(payload).pipe(
        map((response) => {
          return ApplicationActions.getOneSuccess(response);
        }),
        catchError((err) => {
          console.error(err);
          return of(ApplicationActions.getOneFail());
        }),
      ),
    ),
  );

export const ApplicationEpics = combineEpics<AnyAction>(
  createApplicationEpic,
  createFailEpic,
  listApplicationsEpic,
  deleteApplicationEpic,
  editApplicationEpic,
  getApplicationEpic,
);
