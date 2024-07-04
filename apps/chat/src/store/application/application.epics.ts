import { EMPTY, Observable, of } from 'rxjs';
import { catchError, filter, switchMap } from 'rxjs/operators';
import { AnyAction } from '@reduxjs/toolkit';
import { combineEpics } from 'redux-observable';
import { translate } from '@/src/utils/app/translation';
import { ApplicationService } from '@/src/utils/app/data/application-service';
import { CreateApplicationModel } from '@/src/types/applications';
import { UIActions } from '@/src/store/ui/ui.reducers';
import { errorsMessages } from '../../constants/errors';
import {
  create,
  createFail,
  createSuccess,
  list, 
  listSuccess, 
  listFail 
} from '../application/application.reducers'; 

const createApplicationEpic = (action$: Observable<AnyAction>) =>
  action$.pipe(
    filter(create.match),
    switchMap(({ payload }: { payload: CreateApplicationModel }) => {
      return ApplicationService.create(payload).pipe(
          switchMap((application) => of(createSuccess(application))),
          catchError((err) => {
            console.error(err);
            return of(createFail());
          })
        )
    }
    )
  );

const createFailEpic = (action$: Observable<AnyAction>) =>
  action$.pipe(
    filter(createFail.match),
    switchMap(() =>
      of(UIActions.showErrorToast(translate(errorsMessages.createFailed))),
    ),
  );

// Fetch listings epic
const fetchApplicationsListEpic = (action$: Observable<AnyAction>) =>
  action$.pipe(
    filter(list.match),
    switchMap(() =>
      ApplicationService.fetchApplicationsList().pipe(
        switchMap((applications) => of(listSuccess(applications))),
        catchError((err) => {
          console.error(err);
          return of(listFail());
        })
      )
    )
  );

const listFailEpic = (action$: Observable<AnyAction>) =>
  action$.pipe(
    filter(listFail.match),
    switchMap(() =>
      of(UIActions.showErrorToast(translate(errorsMessages.listFailed))),
    ),
  );

export const ApplicationEpics = combineEpics<AnyAction>(
  createApplicationEpic,
  createFailEpic,
  fetchApplicationsListEpic,
  listFailEpic
);