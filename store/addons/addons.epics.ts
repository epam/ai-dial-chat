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

import { combineEpics, ofType } from 'redux-observable';
import {
  Observable,
  catchError,
  from,
  ignoreElements,
  map,
  of,
  switchMap,
  tap,
  throwError,
  withLatestFrom,
} from 'rxjs';

const getAddonsEpic = (
  action$: Observable<any>,
  state$: Observable<RootState>,
) =>
  action$.pipe(
    ofType(getAddons),
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

const updateRecentAddonsEpic = (
  action$: Observable<any>,
  state$: Observable<RootState>,
) =>
  action$.pipe(
    ofType<any, any>(initRecentAddons, updateRecentAddons),
    withLatestFrom(state$),
    map(([_action, state]) => selectRecentAddonsIds(state)),
    tap((recentModelIds) => {
      localStorage.setItem('recentAddonsIds', JSON.stringify(recentModelIds));
    }),
    ignoreElements(),
  );

const AddonsEpics: any = combineEpics(getAddonsEpic, updateRecentAddonsEpic);

export default AddonsEpics;
