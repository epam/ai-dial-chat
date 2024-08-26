import { EMPTY, from, of } from 'rxjs';
import { catchError, filter, map, switchMap } from 'rxjs/operators';

import { combineEpics } from 'redux-observable';

import { getGeneratedApplicationId } from '@/src/utils/app/application';
import { ApplicationService } from '@/src/utils/app/data/application-service';
import { translate } from '@/src/utils/app/translation';
import { ApiUtils } from '@/src/utils/server/api';

import { AppEpic } from '@/src/types/store';

import { UIActions } from '@/src/store/ui/ui.reducers';

import { errorsMessages } from '../../constants/errors';

import { ApplicationActions } from '../application/application.reducers';
import { ModelsActions } from '../models/models.reducers';

const createApplicationEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ApplicationActions.create.match),
    switchMap(({ payload }) => {
      if (!payload.version || !payload.iconUrl) {
        return EMPTY;
      }

      return ApplicationService.create(payload).pipe(
        switchMap((application) =>
          ApplicationService.get(application.url).pipe(
            map((application) => {
              return ModelsActions.addModels({
                models: [application],
              });
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
          return of(
            ApplicationActions.deleteSuccess(),
            ModelsActions.deleteModel(reference),
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
      const newApplicationId = ApiUtils.encodeApiUrl(
        getGeneratedApplicationId(payload.applicationData),
      );
      if (payload.oldApplicationId !== newApplicationId) {
        return ApplicationService.move({
          sourceUrl: payload.oldApplicationId,
          destinationUrl: newApplicationId,
          overwrite: false,
        }).pipe(
          switchMap(() =>
            from([
              ApplicationActions.edit(payload.applicationData),
              ApplicationActions.updateSuccess(),
            ]),
          ),
          catchError((err) => {
            console.error('Failed to update application:', err);
            return of(ApplicationActions.updateFail());
          }),
        );
      }
      return from([
        ApplicationActions.edit(payload.applicationData),
        ApplicationActions.updateSuccess(),
      ]);
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
              model: {
                ...payload,
                id: ApiUtils.encodeApiUrl(getGeneratedApplicationId(payload)),
              },
              oldApplicationId: payload.id,
            }),
          ),
        ),
        catchError((err) => {
          console.error('Failed to edit application:', err);
          return of(ApplicationActions.editFail());
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
