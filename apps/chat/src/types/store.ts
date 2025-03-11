import { NextRouter } from 'next/router';

import { Observable } from 'rxjs';

import { AnyAction, Store } from '@reduxjs/toolkit';

import { StateObservable } from 'redux-observable';

export type RootState = ReturnType<Store['getState']>;

export type AppEpic = (
  action$: Observable<AnyAction>,

  state$: StateObservable<RootState>,

  options: { router: NextRouter },
) => Observable<AnyAction>;
