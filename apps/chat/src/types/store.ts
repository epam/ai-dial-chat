import { NextRouter } from 'next/router';

import { Epic } from 'redux-observable';

import * as allActions from '@/src/store/actions';

import { rootReducer } from '@/src/store';

type ExtractAction<T> =
  T extends Record<string, (...args: never[]) => infer R> ? R : never;

export type AppAction = ExtractAction<
  {
    [K in keyof typeof allActions]: (typeof allActions)[K];
  }[keyof typeof allActions]
>;

export type RootState = ReturnType<typeof rootReducer>;

export type AppEpic = Epic<
  AppAction,
  AppAction,
  RootState,
  { router: NextRouter }
>;
