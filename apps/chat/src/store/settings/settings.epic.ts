import {
  EMPTY,
  catchError,
  concat,
  filter,
  first,
  of,
  switchMap,
  tap,
} from 'rxjs';

import { combineEpics } from 'redux-observable';

import { BucketService } from '@/src/utils/app/data/bucket-service';
import { DataService } from '@/src/utils/app/data/data-service';

import { AppEpic } from '@/src/types/store';

import { errorsMessages } from '@/src/constants/errors';

import { AddonsActions } from '../addons/addons.reducers';
import { AuthSelectors } from '../auth/auth.reducers';
import { ConversationsActions } from '../conversations/conversations.reducers';
import { ModelsActions } from '../models/models.reducers';
import { PromptsActions } from '../prompts/prompts.reducers';
import { ShareActions } from '../share/share.reducers';
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
          BucketService.requestBucket().pipe(
            switchMap(({ bucket }) => {
              BucketService.setBucket(bucket);
              return concat(
                of(UIActions.init()),
                of(ConversationsActions.migrateConversationsIfRequired()),
                of(PromptsActions.migratePromptsIfRequired()),
                of(ModelsActions.init()),
                of(AddonsActions.init()),
                of(ConversationsActions.init()),
                of(PromptsActions.init()),
                of(ShareActions.init()),
              );
            }),
            catchError((error) => {
              if (error.status === 401) {
                window.location.assign('api/auth/signin');
                return EMPTY;
              } else {
                return of(
                  UIActions.showErrorToast(
                    errorsMessages.errorGettingUserBucket,
                  ),
                );
              }
            }),
          ),
        ),
      );
    }),
  );

export const SettingsEpics = combineEpics(initEpic);
