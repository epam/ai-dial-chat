import { EMPTY, of } from 'rxjs';
import { catchError, filter, map, switchMap } from 'rxjs/operators';

import { combineEpics } from 'redux-observable';

import { getGeneratedApplicationId } from '@/src/utils/app/application';
import { ApplicationService } from '@/src/utils/app/data/application-service';
import { translate } from '@/src/utils/app/translation';
import { ApiUtils } from '@/src/utils/server/api';

import { ApplicationListItemModel } from '@/src/types/applications';
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
        // TODO: update types or add fail epic
        return EMPTY;
      }

      return ApplicationService.create(payload).pipe(
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
    switchMap((action) =>
      ApplicationService.delete(action.payload.id).pipe(
        switchMap(() => {
          return of(
            ApplicationActions.deleteSuccess(),
            ModelsActions.deleteModel(action.payload.reference),
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

const updateApplicationEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ApplicationActions.update.match),
    switchMap(({ payload }) => {
      if (
        payload.oldApplicationId !==
        getGeneratedApplicationId(payload.applicationData)
      ) {
        return ApplicationService.move({
          sourceUrl: payload.oldApplicationId,
          destinationUrl: ApiUtils.encodeApiUrl(
            getGeneratedApplicationId(payload.applicationData),
          ),
          overwrite: false,
        }).pipe(
          switchMap(() => of(ApplicationActions.edit(payload.applicationData))),
          catchError((err) => {
            console.error('Move failed', err);
            return EMPTY;
          }),
        );
      }
      return of(ApplicationActions.edit(payload.applicationData));
    }),
  );

const editApplicationEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ApplicationActions.edit.match),
    switchMap(({ payload }) => {
      if (!payload.version || !payload.iconUrl) {
        // TODO: update types or add fail epic
        return EMPTY;
      }

      return ApplicationService.edit(payload).pipe(
        switchMap(() => {
          return of(
            ModelsActions.updateModel({
              model: {
                ...payload,
                id: ApiUtils.encodeApiUrl(getGeneratedApplicationId(payload)),
              },
              oldApplicationId: payload.id,
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
  updateApplicationEpic,
  editApplicationEpic,
  getApplicationEpic,
);
