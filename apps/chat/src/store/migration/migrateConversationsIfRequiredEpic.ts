import { concat, filter, forkJoin, map, of, switchMap } from 'rxjs';

import {
  filterMigratedEntities,
  filterOnlyMyEntities,
} from '@/src/utils/app/common';
import { BrowserStorage } from '@/src/utils/app/data/storages/browser-storage';

import { MigrationStorageKeys, StorageType } from '@/src/types/storage';
import { AppEpic } from '@/src/types/store';

import { ConversationsActions } from '../conversations/conversations.reducers';
import { SettingsSelectors } from '../settings/settings.reducers';
import { UIActions } from '../ui/ui.reducers';
import { MigrationActions } from './migration.reducers';

export const migrateConversationsIfRequiredEpic: AppEpic = (
  action$,
  state$,
) => {
  const browserStorage = new BrowserStorage();

  return action$.pipe(
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
              ConversationsActions.setFailedMigratedConversations({
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
              of(ConversationsActions.setIsChatsBackedUp({ isChatsBackedUp })),
              of(
                ConversationsActions.setFailedMigratedConversations({
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
            ConversationsActions.initConversationsMigration({
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
                      ConversationsActions.migrateConversationFinish({
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
                      ConversationsActions.migrateConversationFinish({
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
};
