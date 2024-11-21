import {
  EMPTY,
  catchError,
  concat,
  concatMap,
  filter,
  forkJoin,
  from,
  map,
  of,
  switchMap,
} from 'rxjs';

import { combineEpics } from 'redux-observable';

import {
  filterMigratedEntities,
  filterOnlyMyEntities,
} from '@/src/utils/app/common';
import { ConversationService } from '@/src/utils/app/data/conversation-service';
import {
  PromptService,
  getPreparedPrompts,
} from '@/src/utils/app/data/prompt-service';
import { getPreparedConversations } from '@/src/utils/app/data/storages/api/conversation-api-storage';
import { BrowserStorage } from '@/src/utils/app/data/storages/browser-storage';

import { Conversation } from '@/src/types/chat';
import { MigrationStorageKeys, StorageType } from '@/src/types/storage';
import { AppEpic } from '@/src/types/store';

import { SettingsSelectors } from '../settings/settings.reducers';
import { UIActions } from '../ui/ui.reducers';
import { MigrationActions, MigrationSelectors } from './migration.reducers';

import orderBy from 'lodash-es/orderBy';

const browserStorage = new BrowserStorage();

const initEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(
      (action) =>
        MigrationActions.init.match(action) &&
        !MigrationSelectors.selectInitialized(state$.value),
    ),
    switchMap(() =>
      concat(
        of(MigrationActions.migrateConversationsIfRequired()),
        of(MigrationActions.migratePromptsIfRequired()),
        of(MigrationActions.initFinish()),
      ),
    ),
  );

const migrateConversationsIfRequiredEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(MigrationActions.migrateConversationsIfRequired.match),
    switchMap(() =>
      forkJoin({
        conversations: browserStorage
          .getConversations()
          .pipe(map(filterOnlyMyEntities)),
        conversationsFolders: browserStorage
          .getConversationsFolders(undefined, true)
          .pipe(map(filterOnlyMyEntities)),
        migratedConversationIds: BrowserStorage.getMigratedEntityIds(
          MigrationStorageKeys.MigratedConversationIds,
        ),
        failedMigratedConversationIds:
          BrowserStorage.getFailedMigratedEntityIds(
            MigrationStorageKeys.FailedMigratedConversationIds,
          ),
        isChatsBackedUp: BrowserStorage.getEntityBackedUp(
          MigrationStorageKeys.ChatsBackedUp,
        ),
        isMigrationInitialized:
          BrowserStorage.getEntitiesMigrationInitialized(),
      }),
    ),
    switchMap(
      ({
        conversations,
        conversationsFolders,
        migratedConversationIds,
        failedMigratedConversationIds,
        isChatsBackedUp,
        isMigrationInitialized,
      }) => {
        const notMigratedConversations = filterMigratedEntities(
          conversations,
          [...failedMigratedConversationIds, ...migratedConversationIds],
          true,
        );

        if (
          !isMigrationInitialized &&
          conversations.length &&
          !failedMigratedConversationIds.length &&
          !migratedConversationIds.length
        ) {
          return concat(
            of(
              MigrationActions.setFailedMigratedConversations({
                failedMigratedConversations: filterMigratedEntities(
                  conversations,
                  conversations.map((c) => c.id),
                ),
              }),
            ),
            of(UIActions.setShowSelectToMigrateWindow(true)),
          );
        }

        if (
          SettingsSelectors.selectStorageType(state$.value) !==
            StorageType.API ||
          !notMigratedConversations.length
        ) {
          if (failedMigratedConversationIds.length) {
            return concat(
              of(MigrationActions.setIsChatsBackedUp({ isChatsBackedUp })),
              of(
                MigrationActions.setFailedMigratedConversations({
                  failedMigratedConversations: filterMigratedEntities(
                    conversations,
                    failedMigratedConversationIds,
                  ),
                }),
              ),
            );
          }

          return EMPTY;
        }

        const conversationsWithoutDate = notMigratedConversations.filter(
          (c) => !c.lastActivityDate,
        );
        const conversationsWithDate = notMigratedConversations.filter(
          (c) => c.lastActivityDate,
        );
        const sortedConversations = [
          ...conversationsWithoutDate,
          ...orderBy(conversationsWithDate, (c) => c.lastActivityDate),
        ];

        const preparedConversations = getPreparedConversations({
          conversations: sortedConversations,
          conversationsFolders,
        });

        let migratedConversationsCount = 0;

        return concat(
          of(
            MigrationActions.initConversationsMigration({
              conversationsToMigrateCount: notMigratedConversations.length,
            }),
          ),
          from(preparedConversations).pipe(
            concatMap((conversation) =>
              ConversationService.setConversations([
                conversation as Conversation,
              ]).pipe(
                concatMap(() => {
                  migratedConversationIds.push(
                    sortedConversations[migratedConversationsCount].id,
                  );

                  return concat(
                    BrowserStorage.setMigratedEntitiesIds(
                      migratedConversationIds,
                      MigrationStorageKeys.MigratedConversationIds,
                    ).pipe(switchMap(() => EMPTY)),
                    of(
                      MigrationActions.migrateConversationFinish({
                        migratedConversationsCount:
                          ++migratedConversationsCount,
                      }),
                    ),
                  );
                }),
                catchError(() => {
                  failedMigratedConversationIds.push(
                    sortedConversations[migratedConversationsCount].id,
                  );

                  return concat(
                    BrowserStorage.setFailedMigratedEntityIds(
                      failedMigratedConversationIds,
                      MigrationStorageKeys.FailedMigratedConversationIds,
                    ).pipe(switchMap(() => EMPTY)),
                    of(
                      MigrationActions.migrateConversationFinish({
                        migratedConversationsCount:
                          ++migratedConversationsCount,
                      }),
                    ),
                  );
                }),
              ),
            ),
          ),
        );
      },
    ),
  );

export const skipFailedMigratedConversationsEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(MigrationActions.skipFailedMigratedConversations.match),
    switchMap(({ payload }) =>
      BrowserStorage.getMigratedEntityIds(
        MigrationStorageKeys.MigratedConversationIds,
      ).pipe(
        switchMap((migratedConversationIds) =>
          concat(
            BrowserStorage.setMigratedEntitiesIds(
              [...payload.idsToMarkAsMigrated, ...migratedConversationIds],
              MigrationStorageKeys.MigratedConversationIds,
            ).pipe(switchMap(() => EMPTY)),
            BrowserStorage.setFailedMigratedEntityIds(
              [],
              MigrationStorageKeys.FailedMigratedConversationIds,
            ).pipe(switchMap(() => EMPTY)),
            of(
              MigrationActions.setFailedMigratedConversations({
                failedMigratedConversations: [],
              }),
            ),
          ),
        ),
      ),
    ),
  );

const migratePromptsIfRequiredEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(MigrationActions.migratePromptsIfRequired.match),
    switchMap(() =>
      forkJoin({
        prompts: browserStorage.getPrompts().pipe(map(filterOnlyMyEntities)),
        promptsFolders: browserStorage
          .getPromptsFolders(undefined, true)
          .pipe(map(filterOnlyMyEntities)),
        migratedPromptIds: BrowserStorage.getMigratedEntityIds(
          MigrationStorageKeys.MigratedPromptIds,
        ),
        failedMigratedPromptIds: BrowserStorage.getFailedMigratedEntityIds(
          MigrationStorageKeys.FailedMigratedPromptIds,
        ),
        isPromptsBackedUp: BrowserStorage.getEntityBackedUp(
          MigrationStorageKeys.PromptsBackedUp,
        ),
        isMigrationInitialized:
          BrowserStorage.getEntitiesMigrationInitialized(),
      }),
    ),
    switchMap(
      ({
        prompts,
        promptsFolders,
        migratedPromptIds,
        failedMigratedPromptIds,
        isPromptsBackedUp,
        isMigrationInitialized,
      }) => {
        const notMigratedPrompts = filterMigratedEntities(
          prompts,
          [...migratedPromptIds, ...failedMigratedPromptIds],
          true,
        );

        if (
          !isMigrationInitialized &&
          prompts.length &&
          !failedMigratedPromptIds.length &&
          !migratedPromptIds.length
        ) {
          return concat(
            of(
              MigrationActions.setFailedMigratedPrompts({
                failedMigratedPrompts: filterMigratedEntities(
                  prompts,
                  prompts.map((p) => p.id),
                ),
              }),
            ),
            of(UIActions.setShowSelectToMigrateWindow(true)),
          );
        }

        if (
          SettingsSelectors.selectStorageType(state$.value) !==
            StorageType.API ||
          !notMigratedPrompts.length
        ) {
          if (failedMigratedPromptIds.length) {
            return concat(
              of(MigrationActions.setIsPromptsBackedUp({ isPromptsBackedUp })),
              of(
                MigrationActions.setFailedMigratedPrompts({
                  failedMigratedPrompts: filterMigratedEntities(
                    prompts,
                    failedMigratedPromptIds,
                  ),
                }),
              ),
            );
          }

          return EMPTY;
        }

        const preparedPrompts = getPreparedPrompts({
          prompts: notMigratedPrompts,
          folders: promptsFolders,
        }); // to send prompts with proper parentPath

        let migratedPromptsCount = 0;

        return concat(
          of(
            MigrationActions.initPromptsMigration({
              promptsToMigrateCount: notMigratedPrompts.length,
            }),
          ),
          from(preparedPrompts).pipe(
            concatMap((prompt) =>
              PromptService.setPrompts([prompt]).pipe(
                switchMap(() => {
                  migratedPromptIds.push(
                    notMigratedPrompts[migratedPromptsCount].id,
                  );

                  return concat(
                    BrowserStorage.setMigratedEntitiesIds(
                      migratedPromptIds,
                      MigrationStorageKeys.MigratedPromptIds,
                    ).pipe(switchMap(() => EMPTY)),
                    of(
                      MigrationActions.migratePromptFinish({
                        migratedPromptsCount: ++migratedPromptsCount,
                      }),
                    ),
                  );
                }),
                catchError(() => {
                  failedMigratedPromptIds.push(
                    notMigratedPrompts[migratedPromptsCount].id,
                  );

                  return concat(
                    BrowserStorage.setFailedMigratedEntityIds(
                      failedMigratedPromptIds,
                      MigrationStorageKeys.FailedMigratedPromptIds,
                    ).pipe(switchMap(() => EMPTY)),
                    of(
                      MigrationActions.migratePromptFinish({
                        migratedPromptsCount: ++migratedPromptsCount,
                      }),
                    ),
                  );
                }),
              ),
            ),
          ),
        );
      },
    ),
  );

export const skipFailedMigratedPromptsEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(MigrationActions.skipFailedMigratedPrompts.match),
    switchMap(({ payload }) =>
      BrowserStorage.getMigratedEntityIds(
        MigrationStorageKeys.MigratedPromptIds,
      ).pipe(
        switchMap((migratedPromptIds) =>
          concat(
            BrowserStorage.setMigratedEntitiesIds(
              [...payload.idsToMarkAsMigrated, ...migratedPromptIds],
              MigrationStorageKeys.MigratedPromptIds,
            ).pipe(switchMap(() => EMPTY)),
            BrowserStorage.setFailedMigratedEntityIds(
              [],
              MigrationStorageKeys.FailedMigratedPromptIds,
            ).pipe(switchMap(() => EMPTY)),
            of(
              MigrationActions.setFailedMigratedPrompts({
                failedMigratedPrompts: [],
              }),
            ),
          ),
        ),
      ),
    ),
  );

export const MigrationEpics = combineEpics(
  initEpic,
  migrateConversationsIfRequiredEpic,
  skipFailedMigratedConversationsEpic,
  migratePromptsIfRequiredEpic,
  skipFailedMigratedPromptsEpic,
);
