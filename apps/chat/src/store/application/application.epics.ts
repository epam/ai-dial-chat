import {
  EMPTY,
  concat,
  concatMap,
  from,
  interval,
  mergeMap,
  of,
  takeUntil,
} from 'rxjs';
import { catchError, filter, map, switchMap } from 'rxjs/operators';

import { combineEpics } from 'redux-observable';

import { regenerateApplicationId } from '@/src/utils/app/application';
import { ApplicationService } from '@/src/utils/app/data/application-service';
import { DataService } from '@/src/utils/app/data/data-service';
import { translate } from '@/src/utils/app/translation';
import { parseApplicationApiKey } from '@/src/utils/server/api';

import {
  ApplicationStatus,
  CustomApplicationModel,
} from '@/src/types/applications';
import { AppEpic } from '@/src/types/store';

import { UIActions } from '@/src/store/ui/ui.reducers';

import { errorsMessages } from '../../constants/errors';
import { DeleteType } from '@/src/constants/marketplace';

import { ApplicationActions } from '../application/application.reducers';
import { ModelsActions } from '../models/models.reducers';

const createApplicationEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ApplicationActions.create.match),
    switchMap(({ payload }) => {
      if (!payload.version || !payload.iconUrl) {
        return EMPTY;
      }

      return ApplicationService.create(
        regenerateApplicationId({ ...payload, reference: '' }),
      ).pipe(
        switchMap((application) =>
          ApplicationService.get(application.id).pipe(
            switchMap((application) => {
              if (application) {
                return concat(
                  of(
                    ModelsActions.addModels({
                      models: [application],
                    }),
                  ),
                  of(
                    ModelsActions.addInstalledModels({
                      references: [application.reference],
                    }),
                  ),
                );
              }

              return of(ApplicationActions.getFail());
            }),
          ),
        ),
        catchError((err) => {
          console.error('Failed to create application:', err);
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
    switchMap(({ payload: { id, reference } }) =>
      ApplicationService.delete(id).pipe(
        switchMap(() => {
          return concat(
            of(
              ModelsActions.removeInstalledModels({
                references: [reference],
                action: DeleteType.DELETE,
              }),
            ),
            of(ApplicationActions.deleteSuccess()),
          );
        }),
        catchError((err) => {
          console.error('Failed to delete application:', err);
          return of(ApplicationActions.deleteFail());
        }),
      ),
    ),
  );

const updateApplicationEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ApplicationActions.update.match),
    switchMap(({ payload }) => {
      const updatedCustomApplication = regenerateApplicationId(
        payload.applicationData,
      ) as CustomApplicationModel;
      if (payload.oldApplicationId !== updatedCustomApplication.id) {
        return DataService.getDataStorage()
          .move({
            sourceUrl: payload.oldApplicationId,
            destinationUrl: updatedCustomApplication.id,
            overwrite: false,
          })
          .pipe(
            switchMap(() =>
              of(ApplicationActions.edit(updatedCustomApplication)),
            ),
            catchError((err) => {
              console.error('Failed to update application:', err);
              return of(
                ApplicationActions.updateFail(),
                UIActions.showErrorToast(
                  translate('Failed to update application'),
                ),
              );
            }),
          );
      }
      return of(ApplicationActions.edit(updatedCustomApplication));
    }),
  );

const editApplicationEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ApplicationActions.edit.match),
    switchMap(({ payload }) => {
      if (!payload.version || !payload.iconUrl) {
        return EMPTY;
      }

      return ApplicationService.edit(payload).pipe(
        switchMap(() =>
          of(
            ApplicationActions.editSuccess(),
            ModelsActions.updateModel({
              model: payload,
              oldApplicationId: payload.id,
            }),
          ),
        ),
        catchError((err) => {
          console.error('Failed to edit application:', err);
          return of(
            ApplicationActions.editFail(),
            UIActions.showErrorToast(translate('Failed to update application')),
          );
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
          return application
            ? ApplicationActions.getSuccess(application)
            : ApplicationActions.getFail();
        }),
        catchError((err) => {
          console.error('Failed to get application:', err);
          return of(ApplicationActions.getFail());
        }),
      ),
    ),
  );

const updateApplicationStatusEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ApplicationActions.startUpdatingFunctionStatus.match),
    mergeMap(({ payload }) => {
      const request =
        payload.status === ApplicationStatus.DEPLOYING
          ? ApplicationService.deploy
          : ApplicationService.undeploy;

      return request(payload.id).pipe(
        switchMap(() =>
          concat(
            of(
              ApplicationActions.updateFunctionStatus({
                id: payload.id,
                status: payload.status,
              }),
            ),
            of(
              ModelsActions.updateFunctionStatus({
                id: payload.id,
                status: payload.status,
              }),
            ),
            of(
              ApplicationActions.continueUpdatingFunctionStatus({
                id: payload.id,
                status: payload.status,
              }),
            ),
          ),
        ),
        catchError(() =>
          of(
            ApplicationActions.updateFunctionStatusFail({
              id: payload.id,
              status: payload.status,
            }),
          ),
        ),
      );
    }),
  );

const continueUpdatingApplicationStatusEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ApplicationActions.continueUpdatingFunctionStatus.match),
    mergeMap(({ payload }) =>
      interval(5000).pipe(
        concatMap(() =>
          from(ApplicationService.get(payload.id)).pipe(
            concatMap((application) => {
              if (
                !application ||
                application?.function?.status === ApplicationStatus.FAILED
              ) {
                return of(
                  ApplicationActions.updateFunctionStatusFail({
                    id: payload.id,
                    status: payload.status,
                  }),
                );
              }

              if (
                application.function?.status === ApplicationStatus.DEPLOYED ||
                application.function?.status === ApplicationStatus.UNDEPLOYED
              ) {
                return concat(
                  of(
                    ModelsActions.updateFunctionStatus({
                      id: payload.id,
                      status: application.function.status,
                    }),
                  ),
                  of(
                    ApplicationActions.updateFunctionStatus({
                      id: payload.id,
                      status: application.function.status,
                    }),
                  ),
                );
              }

              return EMPTY;
            }),
            catchError(() =>
              of(
                ApplicationActions.updateFunctionStatusFail({
                  id: payload.id,
                  status: payload.status,
                }),
              ),
            ),
          ),
        ),
        takeUntil(
          action$.pipe(
            filter(
              (action) =>
                (ApplicationActions.updateFunctionStatusFail.match(action) ||
                  (ApplicationActions.updateFunctionStatus.match(action) &&
                    (action.payload.status === ApplicationStatus.DEPLOYED ||
                      action.payload.status ===
                        ApplicationStatus.UNDEPLOYED))) &&
                payload.id === action.payload.id,
            ),
          ),
        ),
      ),
    ),
  );

const updateApplicationStatusSuccessEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(
      (action) =>
        ApplicationActions.updateFunctionStatus.match(action) &&
        (action.payload.status === ApplicationStatus.DEPLOYED ||
          action.payload.status === ApplicationStatus.UNDEPLOYED),
    ),
    map(({ payload }) => {
      const { name } = parseApplicationApiKey(payload.id);

      return UIActions.showSuccessToast(
        `Application: ${name.split('/').pop()} was successfully ${payload.status.toLowerCase()}`,
      );
    }),
  );

const updateApplicationStatusFailEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ApplicationActions.updateFunctionStatusFail.match),
    mergeMap(({ payload }) => {
      const { name } = parseApplicationApiKey(payload.id);

      return concat(
        of(
          ModelsActions.updateFunctionStatus({
            id: payload.id,
            status: ApplicationStatus.FAILED,
          }),
        ),
        of(
          ApplicationActions.updateFunctionStatus({
            id: payload.id,
            status: ApplicationStatus.FAILED,
          }),
        ),
        of(
          UIActions.showErrorToast(
            `Application: ${name.split('/').pop()} ${payload.status.toLowerCase()} failed`,
          ),
        ),
      );
    }),
  );

export const ApplicationEpics = combineEpics(
  createApplicationEpic,
  createFailEpic,
  deleteApplicationEpic,
  updateApplicationEpic,
  editApplicationEpic,
  getApplicationEpic,

  updateApplicationStatusEpic,
  continueUpdatingApplicationStatusEpic,
  updateApplicationStatusSuccessEpic,
  updateApplicationStatusFailEpic,
);
