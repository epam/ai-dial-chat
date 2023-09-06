import { Observable } from 'rxjs';

import { RootState } from '@/src/store';
import { AnyAction } from '@reduxjs/toolkit';
import { StateObservable } from 'redux-observable';

export type AppEpic = (
  action$: Observable<AnyAction>,

  state$: StateObservable<RootState>,
) => Observable<AnyAction>;
