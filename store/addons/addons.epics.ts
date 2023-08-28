import { OpenAIEntityAddon } from '@/types/openai';

import { RootState } from '../index';
import {
  getAddons,
  getAddonsFail,
  getAddonsSuccess,
  initRecentAddons,
  selectRecentAddonsIds,
  updateRecentAddons,
} from './addons.reducers';

import { Action } from '@reduxjs/toolkit';
import { Epic, combineEpics } from 'redux-observable';
import {
  Observable,
  catchError,
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

const getAddonsEpic: Epic = (
  action$: Observable<Action>,
  state$: Observable<RootState>,
) =>
  action$.pipe(
    filter(getAddons.match),
    withLatestFrom(state$),
    switchMap(() => {
      return from(
        fetch('/api/addons', {
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      ).pipe(
        switchMap((resp) => {
          if (!resp.ok) {
            return throwError(() => resp);
          }
          return from(resp.json());
        }),
        map((response: OpenAIEntityAddon[]) =>
          getAddonsSuccess({ addons: response }),
        ),
        catchError((err) => {
          return of(getAddonsFail({ error: err }));
        }),
      );
    }),
  );

const updateRecentAddonsEpic: Epic = (
  action$: Observable<Action>,
  state$: Observable<RootState>,
) =>
  action$.pipe(
    filter(
      (action) =>
        initRecentAddons.match(action) || updateRecentAddons.match(action),
    ),
    withLatestFrom(state$),
    map(([_action, state]) => selectRecentAddonsIds(state)),
    tap((recentModelIds) => {
      localStorage.setItem('recentAddonsIds', JSON.stringify(recentModelIds));
    }),
    ignoreElements(),
  );

export const AddonsEpics = combineEpics(getAddonsEpic, updateRecentAddonsEpic);
