import { catchError, filter, of, switchMap } from 'rxjs';

import { combineEpics } from 'redux-observable';

import { translate } from '@/src/utils/app/translation';
import { ApiUtils } from '@/src/utils/server/api';

import { HTTPMethod } from '@/src/types/http';
import { AppEpic } from '@/src/types/store';

import { errorsMessages } from '@/src/constants/errors';

import { UIActions } from '../ui/ui.reducers';
import { ServiceActions } from './service.reducer';

const reportIssueEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ServiceActions.reportIssue.match),
    switchMap(({ payload }) => {
      const controller = new AbortController();

      return ApiUtils.request('/api/report-issue', {
        method: HTTPMethod.POST,
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify(payload),
      }).pipe(
        switchMap(() => of(ServiceActions.reportIssueSuccess())),
        catchError(() => of(ServiceActions.reportIssueFail())),
      );
    }),
  );

const reportIssueSuccessEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ServiceActions.reportIssueSuccess.match),
    switchMap(() =>
      of(UIActions.showSuccessToast(translate('Issue reported successfully'))),
    ),
  );

const reportIssueFailEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ServiceActions.reportIssueFail.match),
    switchMap(() =>
      of(
        UIActions.showErrorToast(
          translate(errorsMessages.generalServer, {
            ns: 'common',
          }),
        ),
      ),
    ),
  );

const requestApiKeyEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ServiceActions.requestApiKey.match),
    switchMap(({ payload }) => {
      const controller = new AbortController();

      return ApiUtils.request('/api/request-api-key', {
        method: HTTPMethod.POST,
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify(payload),
      }).pipe(
        switchMap(() => of(ServiceActions.requestApiKeySuccess())),
        catchError(() => of(ServiceActions.requestApiKeyFail())),
      );
    }),
  );

const requestApiKeySuccessEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ServiceActions.requestApiKeySuccess.match),
    switchMap(() =>
      of(
        UIActions.showSuccessToast(translate('API Key requested successfully')),
      ),
    ),
  );

const requestApiKeyFailEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ServiceActions.requestApiKeyFail.match),
    switchMap(() =>
      of(
        UIActions.showErrorToast(
          translate(errorsMessages.generalServer, {
            ns: 'common',
          }),
        ),
      ),
    ),
  );

export const ServiceEpics = combineEpics(
  reportIssueEpic,
  reportIssueSuccessEpic,
  reportIssueFailEpic,
  requestApiKeyEpic,
  requestApiKeySuccessEpic,
  requestApiKeyFailEpic,
);
