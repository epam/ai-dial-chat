import { Observable } from 'rxjs';

import { AnyAction } from '@reduxjs/toolkit';

import { StateObservable } from 'redux-observable';

import { RootState } from '@/src/store';

export type AppEpic = (
  action$: Observable<AnyAction>,

  state$: StateObservable<RootState>,
) => Observable<AnyAction>;
