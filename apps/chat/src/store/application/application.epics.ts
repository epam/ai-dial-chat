import { EMPTY, Observable, of } from 'rxjs';
import { catchError, filter, map, switchMap } from 'rxjs/operators';

import { AnyAction, PayloadAction } from '@reduxjs/toolkit';

import { combineEpics } from 'redux-observable';

import { ApplicationService } from '@/src/utils/app/data/application-service';
import { translate } from '@/src/utils/app/translation';
import { ApiUtils } from '@/src/utils/server/api';

import {
  CreateApplicationModel,
  DeleteApplicationAction,
  FeaturesData,
} from '@/src/types/applications';
import { EntityType } from '@/src/types/common';

import { UIActions } from '@/src/store/ui/ui.reducers';

import { errorsMessages } from '../../constants/errors';

import { ApplicationActions } from '../application/application.reducers';
import { ModelsActions } from '../models/models.reducers';

function createFeatures(features: any): Record<string, string> {
  let featuresData: Record<string, string> = {
    rate: String(!!features.rateEndpoint),
    tokenize: String(!!features.tokenizeEndpoint),
    truncatePrompt: String(!!features.truncatePromptEndpoint),
    configurations: String(!!features.configurationEndpoint),
    systemPrompt: String(!!features.systemPromptSupported),
    tools: String(!!features.toolsSupported),
    seed: String(!!features.seedSupported),
    urlAttachments: String(!!features.urlAttachmentSupported),
    folderAttachments: String(!!features.folderAttachmentSupported),
  };

  for (const [key, value] of Object.entries(features)) {
    if (typeof value === 'string') {
      featuresData[key] = value;
    } else if (typeof value === 'boolean') {
      featuresData[key] = String(value);
    }
  }

  return featuresData;
}

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
                // const featuresData = createFeatures(response.features);                
                return ModelsActions.addModel({
                  model: {
                    id: ApiUtils.encodeApiUrl(response.name),
                    name: response.display_name,
                    version: response.display_version,
                    description: response.description,
                    iconUrl: response.icon_url,
                    type: EntityType.Application,
                    // features: JSON.stringify(featuresData),
                    features: response.features,
                    inputAttachmentTypes: response.input_attachment_types,
                    isDefault: false,
                    maxInputAttachments: response.max_input_attachments,
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
const fetchApplicationsListEpic = (action$: Observable<AnyAction>) =>
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

const fetchApplicationDetailsFailEpic = (action$: Observable<AnyAction>) =>
  action$.pipe(
    filter(ApplicationActions.fetchDetailsFail.match),
    switchMap(() =>
      of(
        UIActions.showErrorToast(translate(errorsMessages.fetchDetailsFailed)),
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
          applicationName: string;
        };
      }) =>
        ApplicationService.edit(
          payload.applicationName,
          payload.applicationData,
        ).pipe(
          switchMap((application) =>
            ApplicationService.getOne(application.url).pipe(
              map((response) => {
                // const featuresData = createFeatures(response.features);
                return ModelsActions.updateModel({
                  model: {
                    id: ApiUtils.encodeApiUrl(response.name),
                    name: response.display_name,
                    version: response.display_version,
                    description: response.description,
                    iconUrl: response.icon_url,
                    type: EntityType.Application,
                    // features: JSON.stringify(featuresData),
                    features: response.features,
                    inputAttachmentTypes: response.input_attachment_types,
                    isDefault: false,
                    maxInputAttachments: response.max_input_attachments,
                  },
                });
              }),
            ),
          ),
          catchError((err) => {
            console.error(err);
            return of(ApplicationActions.editFail());
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
  fetchApplicationsListEpic,
  fetchApplicationDetailsFailEpic,
  deleteApplicationEpic,
  editApplicationEpic,
  getApplicationEpic,
);
