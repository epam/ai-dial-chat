import { catchError, of, switchMap } from 'rxjs';

import { combineEpics, ofType } from 'redux-observable';

import { translate } from '@/src/utils/app/translation';
import { ApiUtils } from '@/src/utils/server/api';

import { HTTPMethod } from '@/src/types/http';
import { AppEpic } from '@/src/types/store';
import { Translation } from '@/src/types/translation';

import { ServiceActions, UIActions } from '@/src/store/actions';

import { CommonI18nKeys } from '@/src/constants/i18n';

const reportIssueEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ServiceActions.reportIssue.type),
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
    ofType(ServiceActions.reportIssueSuccess.type),
    switchMap(() =>
      of(
        UIActions.showSuccessToast(
          translate(CommonI18nKeys.IssueReportedSuccessfully, {
            ns: Translation.Common,
          }),
        ),
      ),
    ),
  );

const reportIssueFailEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ServiceActions.reportIssueFail.type),
    switchMap(() =>
      of(
        UIActions.showErrorToast({
          message: translate(CommonI18nKeys.GeneralServerError, {
            ns: Translation.Common,
          }),
        }),
      ),
    ),
  );

const requestApiKeyEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ServiceActions.requestApiKey.type),
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
    ofType(ServiceActions.requestApiKeySuccess.type),
    switchMap(() =>
      of(
        UIActions.showSuccessToast(
          translate(CommonI18nKeys.ApiKeyRequestedSuccessfully, {
            ns: Translation.Common,
          }),
        ),
      ),
    ),
  );

const requestApiKeyFailEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ServiceActions.requestApiKeyFail.type),
    switchMap(() =>
      of(
        UIActions.showErrorToast({
          message: translate(CommonI18nKeys.GeneralServerError, {
            ns: Translation.Common,
          }),
        }),
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
