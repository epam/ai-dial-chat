import { EMPTY, Observable, forkJoin, iif, of } from 'rxjs';
import { catchError, filter, map, switchMap } from 'rxjs/operators';

import { AnyAction } from '@reduxjs/toolkit';

import { combineEpics } from 'redux-observable';

import { ApplicationService } from '@/src/utils/app/data/application-service';
import { translate } from '@/src/utils/app/translation';
import { ApiUtils } from '@/src/utils/server/api';

import {
  ApplicationListItemModel,
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
          applicationName: string;
          applicationData: CreateApplicationModel;
        };
      }) =>
        ApplicationService.create(
          payload.applicationName,
          payload.applicationData,
        ).pipe(
          switchMap((application: ApplicationListItemModel) =>
            ApplicationService.getOne(application.url).pipe(
              map((response) => {
                return ModelsActions.addModels({
                  models: [
                    {
                      id: response.name,
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
                  ],
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
      ApplicationService.delete(action.payload.currentEntityName).pipe(
        switchMap(() => {
          return of(
            ApplicationActions.deleteSuccess(),
            ModelsActions.deleteModel({
              modelName: action.payload.currentEntityName,
              id: action.payload.currentEntityId,
            }),
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

const editApplicationEpic = (action$: Observable<AnyAction>) =>
  action$.pipe(
    filter((action: any) => action.type === ApplicationActions.edit.type),
    switchMap(
      ({
        payload,
      }: {
        payload: {
          applicationData: CreateApplicationModel;
          oldApplicationName: string;
          currentReference: string;
          oldApplicationId: string;
        };
      }) => {
        const move = iif(
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

        const applicationDataWithReference = {
          ...payload.applicationData,
          reference: payload.currentReference,
        };

        const edit: Observable<ApplicationListItemModel> =
          ApplicationService.edit(applicationDataWithReference).pipe(
            catchError((err) => {
              console.error('Edit failed', err);
              return EMPTY;
            }),
          );

        return forkJoin({
          moveResult: move,
          editResult: edit,
          oldApplicationId: of(payload.oldApplicationId),
        });
      },
    ),
    switchMap(
      ({
        editResult,
        oldApplicationId,
      }: {
        editResult: ApplicationListItemModel;
        oldApplicationId: string;
      }) =>
        ApplicationService.getOne(editResult.url).pipe(
          map((response) => {
            return ModelsActions.updateModel({
              model: {
                id: response.name,
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
              oldApplicationName: oldApplicationId,
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
    switchMap(({ payload }) =>
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
