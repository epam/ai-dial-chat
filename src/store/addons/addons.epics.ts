import {
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

import { OpenAIEntityAddon } from '@/src/types/openai';
import { AppEpic } from '@/src/types/store';

import { AddonsActions, AddonsSelectors } from './addons.reducers';

import { combineEpics } from 'redux-observable';

const getAddonsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(AddonsActions.getAddons.match),
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
    tap((recentModelIds) => {
      localStorage.setItem('recentAddonsIds', JSON.stringify(recentModelIds));
    }),
    ignoreElements(),
  );

export const AddonsEpics = combineEpics(getAddonsEpic, updateRecentAddonsEpic);
