import { RootState } from '..';
import { selectThemeState, setTheme } from './ui.reducers';

import { combineEpics, ofType } from 'redux-observable';
import { Observable, ignoreElements, map, tap, withLatestFrom } from 'rxjs';

const saveSettingsEpic = (
  action$: Observable<any>,

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
const UIEpics: any = combineEpics(saveSettingsEpic);
export default UIEpics;
