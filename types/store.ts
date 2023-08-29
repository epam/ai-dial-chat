import { RootState } from '@/store';
import { AnyAction } from '@reduxjs/toolkit';
import { StateObservable } from 'redux-observable';
import { Observable } from 'rxjs';

export type AppEpic = (
  action$: Observable<AnyAction>,

  state$: StateObservable<RootState>,
) => Observable<AnyAction>;
