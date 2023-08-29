import { UIActions, UISelectors } from './ui.reducers';

import { Epic, combineEpics } from 'redux-observable';
import { filter, ignoreElements, map, tap } from 'rxjs';

const saveThemeEpic: Epic = (action$, state$) =>
  action$.pipe(
    filter(UIActions.setTheme.match),
    map((_action) => UISelectors.selectThemeState(state$.value)),
    tap((theme) => {
      localStorage.setItem('settings', JSON.stringify({ theme }));
    }),
    ignoreElements(),
  );

const saveShowChatbarEpic: Epic = (action$, state$) =>
  action$.pipe(
    filter(UIActions.setShowChatbar.match),
    map((_action) => UISelectors.selectShowChatbar(state$.value)),
    tap((showChatbar) => {
      localStorage.setItem('showChatbar', JSON.stringify(showChatbar));
    }),
    ignoreElements(),
  );

const saveShowPromptbarEpic: Epic = (action$, state$) =>
  action$.pipe(
    filter(UIActions.setShowPromptbar.match),
    map((_action) => UISelectors.selectShowPromptbar(state$.value)),
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
