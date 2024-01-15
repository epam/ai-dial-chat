import { concat, filter, first, of, switchMap, tap } from 'rxjs';

import { combineEpics } from 'redux-observable';

import { DataService } from '@/src/utils/app/data/data-service';

import { AppEpic } from '@/src/types/store';

import { AddonsActions } from '../addons/addons.reducers';
import { AuthSelectors } from '../auth/auth.reducers';
import { ConversationsActions } from '../conversations/conversations.reducers';
import { FilesActions } from '../files/files.reducers';
import { ModelsActions } from '../models/models.reducers';
import { PromptsActions } from '../prompts/prompts.reducers';
import { UIActions } from '../ui/ui.reducers';
import { SettingsActions, SettingsSelectors } from './settings.reducers';

const initEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(SettingsActions.initApp.match),
    tap(() => {
      const storageType = SettingsSelectors.selectStorageType(state$.value);
      DataService.init(storageType);
    }),
    switchMap(() => {
      return state$.pipe(
        filter(() => {
          const authStatus = AuthSelectors.selectStatus(state$.value);
          const shouldLogin = AuthSelectors.selectIsShouldLogin(state$.value);

          return authStatus !== 'loading' && !shouldLogin;
        }),
        first(),
        switchMap(() =>
          concat(
            of(UIActions.init()),
            of(ModelsActions.init()),
            of(AddonsActions.init()),
            of(ConversationsActions.init()),
            of(PromptsActions.init()),
            of(FilesActions.init()),
          ),
        ),
      );
    }),
  );

export const SettingsEpics = combineEpics(initEpic);
