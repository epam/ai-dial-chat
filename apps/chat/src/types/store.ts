import { NextRouter } from 'next/router';

import { Store } from '@reduxjs/toolkit';

import { Epic } from 'redux-observable';

import * as allActions from '@/src/store/actions';

type ExtractAction<T> =
  T extends Record<string, (...args: never[]) => infer R> ? R : never;

export type RootAction = ExtractAction<
  {
    [K in keyof typeof allActions]: (typeof allActions)[K];
  }[keyof typeof allActions]
>;

export type RootState = ReturnType<Store['getState']>;

export type AppEpic = Epic<
  RootAction,
  RootAction,
  RootState,
  { router: NextRouter }
>;
