import { RootState } from '..';
import { UIActions, UISelectors } from './ui.reducers';

import { Action } from '@reduxjs/toolkit';
import { Epic, combineEpics } from 'redux-observable';
import {
  Observable,
  filter,
  ignoreElements,
  map,
  tap,
  withLatestFrom,
} from 'rxjs';

const saveThemeEpic: Epic = (
  action$: Observable<Action>,
  state$: Observable<RootState>,
) =>
  action$.pipe(
    filter(UIActions.setTheme.match),
    withLatestFrom(state$),
    map(([_action, state]) => UISelectors.selectThemeState(state)),
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
    filter(UIActions.setShowChatbar.match),
    withLatestFrom(state$),
    map(([_action, state]) => UISelectors.selectShowChatbar(state)),
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
    filter(UIActions.setShowPromptbar.match),
    withLatestFrom(state$),
    map(([_action, state]) => UISelectors.selectShowPromptbar(state)),
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
