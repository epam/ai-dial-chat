import { EMPTY, Observable, of } from 'rxjs';
import { catchError, filter, switchMap } from 'rxjs/operators';

import { AnyAction } from '@reduxjs/toolkit';

import { combineEpics } from 'redux-observable';

import { ApplicationService } from '@/src/utils/app/data/application-service';
import { translate } from '@/src/utils/app/translation';

import { CreateApplicationModel } from '@/src/types/applications';

import { UIActions } from '@/src/store/ui/ui.reducers';

import { errorsMessages } from '../../constants/errors';

import { ApplicationActions } from '../application/application.reducers';

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
      }) => {
        return ApplicationService.create(
          payload.applicationName,
          payload.applicationData,
        ).pipe(
          switchMap((application) =>
            of(ApplicationActions.createSuccess(application)),
          ),
          catchError((err) => {
            console.error(err);
            return of(ApplicationActions.createFail());
          }),
        );
      },
    ),
  );

const createFailEpic = (action$: Observable<AnyAction>) =>
  action$.pipe(
    filter(ApplicationActions.createFail.match),
    switchMap(() =>
      of(UIActions.showErrorToast(translate(errorsMessages.createFailed))),
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

const listFailEpic = (action$: Observable<AnyAction>) =>
  action$.pipe(
    filter(ApplicationActions.listFail.match),
    switchMap(() =>
      of(UIActions.showErrorToast(translate(errorsMessages.listFailed))),
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

// calls API to fetch application details
const fetchApplicationDetailsEpic = (action$: Observable<AnyAction>) =>
  action$.pipe(
    filter(ApplicationActions.fetchDetails.match),
    switchMap(
      (
        { payload }: { payload: string }, // assuming payload to be appID
      ) =>
        ApplicationService.fetchWriteOnlyAppDetails(payload).pipe(
          switchMap((applicationDetails) =>
            of(ApplicationActions.fetchDetailsSuccess(applicationDetails)),
          ),
          catchError((err) => {
            console.error(err);
            return of(ApplicationActions.fetchDetailsFail());
          }),
        ),
    ),
  );

const fetchReadOnlyAppDetailsEpic = (action$: Observable<AnyAction>) =>
  action$.pipe(
    filter(ApplicationActions.fetchReadOnlyAppDetails.match),
    switchMap(({ payload }: { payload: string }) =>
      ApplicationService.fetchReadOnlyAppDetails(payload).pipe(
        switchMap((appDetailsReadOnly) =>
          of(
            ApplicationActions.fetchReadOnlyAppDetailsSuccess(
              appDetailsReadOnly,
            ),
          ),
        ),
        catchError((err) => {
          console.error(err);
          return of(ApplicationActions.fetchReadOnlyAppDetailsFail());
        }),
      ),
    ),
  );

const fetchReadOnlyAppDetailsFailEpic = (action$: Observable<AnyAction>) =>
  action$.pipe(
    filter(ApplicationActions.fetchReadOnlyAppDetailsFail.match),
    switchMap(() =>
      of(
        UIActions.showErrorToast(translate(errorsMessages.fetchDetailsFailed)),
      ),
    ),
  );

const fetchOpenAIApplicationsEpic = (action$: Observable<AnyAction>) =>
  action$.pipe(
    filter(ApplicationActions.fetchOpenAIApplications.match),
    switchMap(() =>
      ApplicationService.fetchOpenAIApplications().pipe(
        switchMap((openaiApplications) =>
          of(
            ApplicationActions.fetchOpenAIApplicationsSuccess(
              openaiApplications,
            ),
          ),
        ),
        catchError((err) => {
          console.error(err);
          return of(ApplicationActions.fetchOpenAIApplicationsFail());
        }),
      ),
    ),
  );

const fetchOpenAIApplicationsFailEpic = (action$: Observable<AnyAction>) =>
  action$.pipe(
    filter(ApplicationActions.fetchOpenAIApplicationsFail.match),
    switchMap(() =>
      of(
        UIActions.showErrorToast(translate(errorsMessages.fetchDetailsFailed)),
      ),
    ),
  );

export const ApplicationEpics = combineEpics<AnyAction>(
  createApplicationEpic,
  createFailEpic,
  fetchApplicationsListEpic,
  listFailEpic,
  fetchApplicationDetailsEpic,
  fetchApplicationDetailsFailEpic,
  fetchReadOnlyAppDetailsEpic,
  fetchReadOnlyAppDetailsFailEpic,
  fetchOpenAIApplicationsEpic,
  fetchOpenAIApplicationsFailEpic,
);
