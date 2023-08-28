import { RootState } from '..';
import { uiActions, uiSelectors } from './ui.reducers';

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
    filter(uiActions.setTheme.match),
    withLatestFrom(state$),

    map(([_action, state]) => uiSelectors.selectThemeState(state)),
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
    filter(uiActions.setShowChatbar.match),
    withLatestFrom(state$),

    map(([_action, state]) => uiSelectors.selectShowChatbar(state)),
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
    filter(uiActions.setShowPromptbar.match),
    withLatestFrom(state$),

    map(([_action, state]) => uiSelectors.selectShowPromptbar(state)),
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
