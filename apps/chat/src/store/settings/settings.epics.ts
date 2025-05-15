import {
  EMPTY,
  Observable,
  catchError,
  concat,
  endWith,
  filter,
  first,
  of,
  startWith,
  switchMap,
  tap,
} from 'rxjs';

import { combineEpics, ofType } from 'redux-observable';

import { BucketService } from '@/src/utils/app/data/bucket-service';
import { DataService } from '@/src/utils/app/data/data-service';
import { DefaultsService } from '@/src/utils/app/data/defaults-service';

import { PageType } from '@/src/types/common';
import { AppAction, AppEpic } from '@/src/types/store';

import { ApplicationActions } from '@/src/store/application/application.reducers';
import { ConversationsActions } from '@/src/store/conversations/conversations.reducers';
import { ModelsActions } from '@/src/store/models/models.reducers';
import { PromptsActions } from '@/src/store/prompts/prompts.reducers';
import { UIActions } from '@/src/store/ui/ui.reducers';

import { errorsMessages } from '@/src/constants/errors';

import { AddonsActions } from '../addons/addons.reducers';
import { ApplicationTypesSchemasActions } from '../applicationTypeSchemas/applicationTypeSchemas.reducers';
import { AuthSelectors } from '../auth/auth.selectors';
import { FilesActions } from '../files/files.reducers';
import { MarketplaceActions } from '../marketplace/marketplace.reducers';
import { MigrationActions } from '../migration/migration.reducers';
import { PublicationActions } from '../publication/publication.reducers';
import { SettingsActions } from './settings.reducers';
import { SettingsSelectors } from './settings.selectors';

const getInitActions = (page?: PageType): Observable<AppAction>[] => {
  switch (page) {
    case PageType.Marketplace:
      return [
        of(UIActions.init()),
        of(ModelsActions.init()),
        of(ApplicationActions.init()),
        of(AddonsActions.init()),
        of(FilesActions.init()),
        of(PublicationActions.init()),
        of(ApplicationTypesSchemasActions.init()),
        of(ConversationsActions.initShare()),
        of(MarketplaceActions.init()),
      ];
    case PageType.Chat:
      return [
        of(UIActions.init()),
        of(MigrationActions.init()),
        of(ModelsActions.init()),
        of(ApplicationActions.init()),
        of(AddonsActions.init()),
        of(ConversationsActions.init()),
        of(PromptsActions.init()),
        of(FilesActions.init()),
        of(PublicationActions.init()),
        of(ApplicationTypesSchemasActions.init()),
      ];
    case PageType.AppsEditorSettings:
    case PageType.AppsEditorGeneralInfo:
      return [
        of(UIActions.init()),
        of(ModelsActions.init()),
        of(AddonsActions.init()),
        of(FilesActions.init()),
        of(PublicationActions.init()),
        of(ConversationsActions.init()),
        of(ApplicationTypesSchemasActions.init()),
      ];
    default:
      return [
        of(UIActions.init()),
        of(ModelsActions.init()),
        of(ApplicationActions.init()),
        of(AddonsActions.init()),
        of(FilesActions.init()),
        of(PublicationActions.init()),
        of(ConversationsActions.init()),
        of(ApplicationTypesSchemasActions.init()),
      ];
  }
};

const initEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(SettingsActions.initApp.type),
    tap(() => {
      const storageType = SettingsSelectors.selectStorageType(state$.value);
      const defaults = SettingsSelectors.selectDefaults(state$.value);
      DefaultsService.setDefaults(defaults);
      DataService.init(storageType);
    }),
    switchMap(({ payload }) => {
      return state$.pipe(
        filter(() => {
          const authStatus = AuthSelectors.selectStatus(state$.value);
          const shouldLogin = AuthSelectors.selectIsShouldLogin(state$.value);
          return authStatus !== 'loading' && !shouldLogin;
        }),
        first(),
        switchMap(() =>
          (BucketService.getBucket()
            ? of({ bucket: BucketService.getBucket() })
            : BucketService.requestBucket()
          ).pipe(
            switchMap(({ bucket }) => {
              BucketService.setBucket(bucket);
              return concat(...getInitActions(payload));
            }),
            catchError((error) => {
              if (error.status === 401) {
                window.location.assign('/api/auth/signin');
                return EMPTY;
              } else {
                return of(
                  UIActions.showErrorToast(
                    errorsMessages.errorGettingUserBucket,
                  ),
                );
              }
            }),
            startWith(SettingsActions.initStart()),
            endWith(SettingsActions.initComplete()),
          ),
        ),
      );
    }),
  );

export const SettingsEpics = combineEpics(initEpic);
