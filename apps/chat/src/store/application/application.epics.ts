import { EMPTY, of } from 'rxjs';
import { catchError, filter, map, switchMap } from 'rxjs/operators';

import { combineEpics } from 'redux-observable';

import { ApplicationService } from '@/src/utils/app/data/application-service';
import { constructPath } from '@/src/utils/app/file';
import { getFolderIdFromEntityId } from '@/src/utils/app/folders';
import { translate } from '@/src/utils/app/translation';
import { ApiUtils } from '@/src/utils/server/api';

import {
  ApplicationListItemModel,
  CreateApplicationModel,
  DeleteApplicationAction,
} from '@/src/types/applications';
import { AppEpic } from '@/src/types/store';

import { UIActions } from '@/src/store/ui/ui.reducers';

import { errorsMessages } from '../../constants/errors';

import { ApplicationActions } from '../application/application.reducers';
import { ModelsActions } from '../models/models.reducers';

const createApplicationEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ApplicationActions.create.match),
    switchMap(({ payload: { applicationData, applicationName } }) => {
      if (!applicationData.version || !applicationData.iconUrl) {
        // TODO: update types or add fail epic
        return EMPTY;
      }

      const apiFormattedData: CreateApplicationModel = {
        endpoint: applicationData.completionUrl,
        display_name: applicationData.name,
        display_version: applicationData.version,
        icon_url: applicationData.iconUrl,
        description: applicationData.description,
        features: applicationData.features,
        input_attachment_types: applicationData.inputAttachmentTypes,
        max_input_attachments: applicationData.maxInputAttachments,
        defaults: {},
      };

      return ApplicationService.create(applicationName, apiFormattedData).pipe(
        switchMap((application: ApplicationListItemModel) =>
          ApplicationService.get(application.url).pipe(
            map((application) => {
              return ModelsActions.addModels({
                models: [application],
              });
            }),
          ),
        ),
        catchError((err) => {
          console.error(err);
          return of(ApplicationActions.createFail());
        }),
      );
    }),
  );

const createFailEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ApplicationActions.createFail.match),
    switchMap(() =>
      of(UIActions.showErrorToast(translate(errorsMessages.createFailed))),
    ),
  );

const deleteApplicationEpic: AppEpic = (action$) =>
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
const listApplicationsEpic: AppEpic = (action$) =>
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

const moveApplicationEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ApplicationActions.move.match),
    switchMap(({ payload }) => {
      if (payload.oldApplicationName !== payload.applicationData.name) {
        return ApplicationService.move({
          sourceUrl: payload.oldApplicationName,
          destinationUrl: payload.applicationData.name,
          overwrite: false,
        }).pipe(
          switchMap(() => of(ApplicationActions.edit(payload))),
          catchError((err) => {
            console.error('Move failed', err);
            return EMPTY;
          }),
        );
      }
      return of(ApplicationActions.edit(payload));
    }),
  );

const editApplicationEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ApplicationActions.edit.match),
    switchMap(({ payload: { applicationData, oldApplicationName } }) => {
      if (!applicationData.version || !applicationData.iconUrl) {
        // TODO: update types or add fail epic
        return EMPTY;
      }

      const apiFormattedData: CreateApplicationModel = {
        endpoint: applicationData.completionUrl,
        display_name: applicationData.name,
        display_version: applicationData.version,
        icon_url: applicationData.iconUrl,
        description: applicationData.description,
        features: applicationData.features,
        input_attachment_types: applicationData.inputAttachmentTypes,
        max_input_attachments: applicationData.maxInputAttachments,
        defaults: {},
      };

      return ApplicationService.edit(apiFormattedData).pipe(
        switchMap(() => {
          return of(
            ModelsActions.updateModel({
              model: {
                ...applicationData,
                id: constructPath(
                  getFolderIdFromEntityId(applicationData.id),
                  ApiUtils.encodeApiUrl(applicationData.name),
                ),
              },
              oldApplicationName,
            }),
          );
        }),
        catchError((err) => {
          console.error('Edit failed', err);
          return EMPTY;
        }),
      );
    }),
  );

const getApplicationEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ApplicationActions.get.match),
    switchMap(({ payload }) =>
      ApplicationService.get(payload).pipe(
        map((application) => {
          return ApplicationActions.getSuccess(application);
        }),
        catchError((err) => {
          console.error(err);
          return of(ApplicationActions.getFail());
        }),
      ),
    ),
  );

export const ApplicationEpics = combineEpics(
  createApplicationEpic,
  createFailEpic,
  listApplicationsEpic,
  deleteApplicationEpic,
  moveApplicationEpic,
  editApplicationEpic,
  getApplicationEpic,
);
