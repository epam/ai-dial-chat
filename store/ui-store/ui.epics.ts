import { RootState } from '..';
import {
  selectShowChatbar,
  selectShowPromptbar,
  selectThemeState,
  setShowChatbar,
  setShowPromptbar,
  setTheme,
} from './ui.reducers';

import { Action } from '@reduxjs/toolkit';
import { Epic, combineEpics, ofType } from 'redux-observable';
import { Observable, ignoreElements, map, tap, withLatestFrom } from 'rxjs';

const saveThemeEpic: Epic = (
  action$: Observable<Action>,

  state$: Observable<RootState>,
) =>
  action$.pipe(
    ofType<any, any>(setTheme),
    withLatestFrom(state$),

    map(([_action, state]) => selectThemeState(state)),
    tap((theme) => {
      localStorage.setItem('settings', JSON.stringify({ theme }));
    }),
    ignoreElements(),
  );
const saveShowChatbarEpic: Epic = (
  action$: Observable<Action>,

  state$: Observable<RootState>,
) =>
  action$.pipe(
    ofType<any, any>(setShowChatbar),
    withLatestFrom(state$),

    map(([_action, state]) => selectShowChatbar(state)),
    tap((showChatbar) => {
      localStorage.setItem('showChatbar', JSON.stringify(showChatbar));
    }),
    ignoreElements(),
  );

const saveShowPromptbarEpic: Epic = (
  action$: Observable<Action>,

  state$: Observable<RootState>,
) =>
  action$.pipe(
    ofType<any, any>(setShowPromptbar),
    withLatestFrom(state$),

    map(([_action, state]) => selectShowPromptbar(state)),
    tap((showPromptbar) => {
      localStorage.setItem('showPromptbar', JSON.stringify(showPromptbar));
    }),
    ignoreElements(),
  );
const UIEpics = combineEpics(
  saveThemeEpic,
  saveShowChatbarEpic,
  saveShowPromptbarEpic,
);
export default UIEpics;
