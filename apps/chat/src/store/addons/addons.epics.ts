import {
  catchError,
  concat,
  filter,
  from,
  ignoreElements,
  map,
  of,
  switchMap,
  tap,
  throwError,
  withLatestFrom,
} from 'rxjs';
import { fromFetch } from 'rxjs/fetch';

import { combineEpics } from 'redux-observable';

import { DataService } from '@/src/utils/app/data/data-service';

import { DialAIEntityAddon } from '@/src/types/models';
import { AppEpic } from '@/src/types/store';

import { SettingsSelectors } from '../settings/settings.reducers';
import { AddonsActions, AddonsSelectors } from './addons.reducers';

const initEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(
      (action) =>
        AddonsActions.init.match(action) &&
        !AddonsSelectors.selectInitialized(state$.value),
    ),
    switchMap(() => DataService.getRecentAddonsIds()),
    switchMap((recentAddonsIds) =>
      concat(
        of(
          AddonsActions.initRecentAddons({
            defaultRecentAddonsIds:
              SettingsSelectors.selectDefaultRecentAddonsIds(state$.value),
            localStorageRecentAddonsIds: recentAddonsIds,
          }),
        ),
        of(AddonsActions.getAddons()),
        of(AddonsActions.initFinish()),
      ),
    ),
  );

const getAddonsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(AddonsActions.getAddons.match),
    withLatestFrom(state$),
    switchMap(() => {
      return fromFetch('/api/addons', {
        headers: {
          'Content-Type': 'application/json',
        },
      }).pipe(
        switchMap((resp) => {
          if (!resp.ok) {
            return throwError(() => resp);
          }
          return from(resp.json());
        }),
        map((response: DialAIEntityAddon[]) =>
          AddonsActions.getAddonsSuccess({ addons: response }),
        ),
        catchError((err) => {
          return of(AddonsActions.getAddonsFail({ error: err }));
        }),
      );
    }),
  );

const updateRecentAddonsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(
      (action) =>
        AddonsActions.initRecentAddons.match(action) ||
        AddonsActions.updateRecentAddons.match(action),
    ),
    withLatestFrom(state$),
    map(([_action, state]) => AddonsSelectors.selectRecentAddonsIds(state)),
    switchMap((recentAddonsIds) => {
      return DataService.setRecentAddonsIds(recentAddonsIds);
    }),
    ignoreElements(),
  );

const getAddonsFailEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(AddonsActions.getAddonsFail.match),
    tap(({ payload }) => {
      if (payload.error.status === 401) {
        window.location.assign('/api/auth/signin');
      }
    }),
    ignoreElements(),
  );

export const AddonsEpics = combineEpics(
  initEpic,
  getAddonsEpic,
  updateRecentAddonsEpic,
  getAddonsFailEpic,
);
