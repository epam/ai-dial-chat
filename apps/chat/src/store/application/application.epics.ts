import { EMPTY, concat, of } from 'rxjs';
import { catchError, filter, map, switchMap } from 'rxjs/operators';

import { combineEpics } from 'redux-observable';

import { regenerateApplicationId } from '@/src/utils/app/application';
import { ApplicationService } from '@/src/utils/app/data/application-service';
import { DataService } from '@/src/utils/app/data/data-service';
import { translate } from '@/src/utils/app/translation';

import { CustomApplicationModel } from '@/src/types/applications';
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

export const ApplicationEpics = combineEpics(
  createApplicationEpic,
  createFailEpic,
  deleteApplicationEpic,
  updateApplicationEpic,
  editApplicationEpic,
  getApplicationEpic,
);
