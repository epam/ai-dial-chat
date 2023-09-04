import { filter, ignoreElements, tap } from 'rxjs';

import { AppEpic } from '@/types/store';

import { UIActions } from './ui.reducers';

import { combineEpics } from 'redux-observable';

const saveThemeEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(UIActions.setTheme.match),
    tap(({ payload }) => {
      localStorage.setItem('settings', JSON.stringify({ theme: payload }));
    }),
    ignoreElements(),
  );

const saveShowChatbarEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(UIActions.setShowChatbar.match),
    tap(({ payload }) => {
      localStorage.setItem('showChatbar', JSON.stringify(payload));
    }),
    ignoreElements(),
  );

const saveShowPromptbarEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(UIActions.setShowPromptbar.match),
    tap(({ payload }) => {
      localStorage.setItem('showPromptbar', JSON.stringify(payload));
    }),
    ignoreElements(),
  );

const UIEpics = combineEpics(
  saveThemeEpic,
  saveShowChatbarEpic,
  saveShowPromptbarEpic,
);

export default UIEpics;
