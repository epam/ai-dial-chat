import {
  IconBulb,
  IconCheck,
  IconCircleCheck,
  IconDownload,
  IconMinus,
} from '@tabler/icons-react';
import { ReactElement, useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';

import { useRouter } from 'next/router';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { BrowserStorage } from '@/src/utils/app/data/storages/browser-storage';
import { isSmallScreen } from '@/src/utils/app/mobile';

import { Conversation } from '@/src/types/chat';
import { Prompt } from '@/src/types/prompt';
import { MigrationStorageKeys } from '@/src/types/storage';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ImportExportActions } from '@/src/store/import-export/importExport.reducers';
import {
  MigrationActions,
  MigrationSelectors,
} from '@/src/store/migration/migration.reducers';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UIActions } from '@/src/store/ui/ui.reducers';

import { ReportIssueDialog } from '@/src/components/Chat/ReportIssueDialog';
import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';

import { Feature } from '@epam/ai-dial-shared';

interface ItemsListProps<T> {
  entitiesToRetryIds: string[];
  setEntitiesToRetryIds: (entityId: string[]) => void;
  failedMigratedEntities: T[];
  getModelIcon: (entity: T) => ReactElement;
  withPt?: boolean;
}

const ItemsList = <T extends Conversation | Prompt>({
  entitiesToRetryIds,
  setEntitiesToRetryIds,
  failedMigratedEntities,
  getModelIcon,
  withPt,
}: ItemsListProps<T>) => {
  const handleSelect = (entityId: string) => {
    setEntitiesToRetryIds([...new Set([...entitiesToRetryIds, entityId])]);
  };

  const handleUnselect = (entityId: string) => {
    setEntitiesToRetryIds(entitiesToRetryIds.filter((id) => id !== entityId));
  };

  if (!failedMigratedEntities.length) return null;

  return (
    <div className={classNames('mt-2', withPt && 'pt-2')}>
      <ul className="flex flex-col gap-0.5">
        {failedMigratedEntities.map((entity) => (
          <li
            className="flex h-[30px] items-center justify-between rounded"
            key={entity.id}
          >
            <div className="flex min-w-0">
              {getModelIcon(entity)}
              <p className="ml-2 truncate">{entity.name}</p>
            </div>
            <div className="flex min-w-[100px] items-center justify-around">
              <div
                onClick={() => handleSelect(entity.id)}
                className="relative flex size-[18px] group-hover/file-item:flex"
              >
                <input
                  className="checkbox peer size-[18px] bg-transparent"
                  type="checkbox"
                  readOnly
                  checked={entitiesToRetryIds.includes(entity.id)}
                />
                <IconCheck
                  size={18}
                  className="pointer-events-none invisible absolute text-accent-primary peer-checked:visible"
                />
              </div>
              <div
                onClick={() => handleUnselect(entity.id)}
                className="relative flex size-[18px] group-hover/file-item:flex"
              >
                <input
                  className="checkbox peer size-[18px] bg-transparent"
                  type="checkbox"
                  readOnly
                  checked={!entitiesToRetryIds.includes(entity.id)}
                />
                <IconCheck
                  size={18}
                  className="pointer-events-none invisible absolute text-accent-primary peer-checked:visible"
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

interface AllItemsCheckboxesProps {
  isChecked: boolean;
  isCheckIcon: boolean;
  isMinusIcon: boolean;
  onSelectHandler: () => void;
}

const AllItemsCheckboxes = ({
  isChecked,
  isCheckIcon,
  isMinusIcon,
  onSelectHandler,
}: AllItemsCheckboxesProps) => {
  const Icon = isCheckIcon ? IconCheck : isMinusIcon ? IconMinus : null;

  return (
    <div className="relative flex size-[18px] group-hover/file-item:flex">
      <input
        className="checkbox peer size-[18px] bg-transparent"
        type="checkbox"
        onClick={onSelectHandler}
        readOnly
        checked={isChecked}
      />
      {Icon && (
        <Icon
          size={18}
          className="pointer-events-none invisible absolute text-accent-primary peer-checked:visible"
        />
      )}
    </div>
  );
};

interface Props {
  failedMigratedConversations: Conversation[];
  failedMigratedPrompts: Prompt[];
  showSelectToMigrateWindow: boolean;
}

export const MigrationFailedWindow = ({
  failedMigratedConversations,
  failedMigratedPrompts,
  showSelectToMigrateWindow,
}: Props) => {
  const { t } = useTranslation(Translation.Common);

  const dispatch = useDispatch();

  const router = useRouter();

  const [conversationsToRetryIds, setConversationsToRetryIds] = useState<
    string[]
  >([]);
  const [promptsToRetryIds, setPromptsToRetryIds] = useState<string[]>([]);
  const [isReportIssueDialogOpen, setIsReportIssueDialogOpen] = useState(false);
  const [dontWantBackup, setDontWantBackup] = useState(false);
  const [isScreenSmall, setIsScreenSmall] = useState(isSmallScreen());

  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const isPromptsBackedUp = useAppSelector(
    MigrationSelectors.selectIsPromptsBackedUp,
  );
  const isChatsBackedUp = useAppSelector(
    MigrationSelectors.selectIsChatsBackedUp,
  );

  useEffect(() => {
    const handleResize = () => setIsScreenSmall(isSmallScreen());
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setConversationsToRetryIds(
      failedMigratedConversations.map((conv) => conv.id),
    );
  }, [failedMigratedConversations]);

  useEffect(() => {
    setPromptsToRetryIds(failedMigratedPrompts.map((prompt) => prompt.id));
  }, [failedMigratedPrompts]);

  const retryMigration = useCallback(() => {
    const failedMigratedConversationIds = failedMigratedConversations.map(
      (conv) => conv.id,
    );
    const failedMigratedPromptIds = failedMigratedPrompts.map(
      (conv) => conv.id,
    );

    BrowserStorage.setEntitiesMigrationInitialized();
    dispatch(UIActions.setShowSelectToMigrateWindow(false));

    dispatch(
      MigrationActions.skipFailedMigratedConversations({
        idsToMarkAsMigrated: failedMigratedConversationIds.filter(
          (id) => !conversationsToRetryIds.includes(id),
        ),
      }),
    );
    dispatch(
      MigrationActions.skipFailedMigratedPrompts({
        idsToMarkAsMigrated: failedMigratedPromptIds.filter(
          (id) => !promptsToRetryIds.includes(id),
        ),
      }),
    );

    dispatch(MigrationActions.migrateConversationsIfRequired());
    dispatch(MigrationActions.migratePromptsIfRequired());
  }, [
    conversationsToRetryIds,
    dispatch,
    failedMigratedConversations,
    failedMigratedPrompts,
    promptsToRetryIds,
  ]);

  const handleBackupPrompts = useCallback(() => {
    dispatch(ImportExportActions.exportLocalStoragePrompts());
    BrowserStorage.setEntityBackedUp(MigrationStorageKeys.PromptsBackedUp);
  }, [dispatch]);

  const handleBackupChats = useCallback(() => {
    dispatch(ImportExportActions.exportLocalStorageChats());
    BrowserStorage.setEntityBackedUp(MigrationStorageKeys.ChatsBackedUp);
  }, [dispatch]);

  const handleSelectAll = useCallback(() => {
    setConversationsToRetryIds(
      failedMigratedConversations.map((conv) => conv.id),
    );
    setPromptsToRetryIds(failedMigratedPrompts.map((prompt) => prompt.id));
  }, [failedMigratedConversations, failedMigratedPrompts]);

  const handleUnselectAll = () => {
    setConversationsToRetryIds([]);
    setPromptsToRetryIds([]);
  };

  const isAllItemsSelected =
    conversationsToRetryIds.length + promptsToRetryIds.length ===
    failedMigratedPrompts.length + failedMigratedConversations.length;
  const isSomeItemsSelected =
    !!conversationsToRetryIds.length || !!promptsToRetryIds.length;
  const isNothingSelected =
    !conversationsToRetryIds.length && !promptsToRetryIds.length;
  const isNextButtonEnabled =
    dontWantBackup ||
    ((isChatsBackedUp || !failedMigratedConversations.length) &&
      (isPromptsBackedUp || !failedMigratedPrompts.length));

  return (
    <div className="flex size-full flex-col items-center justify-center p-2">
      <div className="flex max-h-[90%] w-full max-w-[523px] flex-col rounded bg-layer-2 pt-6">
        <div className="flex max-h-full flex-col pb-4">
          <div className="px-6">
            <h1 className="text-base font-semibold">
              {showSelectToMigrateWindow
                ? t('Now your data will be available on all your devices')
                : t('Some items failed to migrate, retry migration?')}
            </h1>
            <p className="mt-2 text-secondary">
              {showSelectToMigrateWindow ? (
                <>
                  {t('All current conversations')}
                  <wbr />
                  /
                  <wbr />
                  {t(
                    'prompts from all devices will be migrated to the central storage. Select items to migrate or discard. ',
                  )}
                </>
              ) : (
                <>
                  {t(
                    'Retry migration or discard the unsuccessfully migrated conversations',
                  )}
                  <wbr />
                  /
                  <wbr />
                  {t('prompts. ')}
                </>
              )}
              {t('All discarded items will be ')}
              <strong>{t('PERMANENTLY LOST')}</strong>.
            </p>
            <div className="mt-4 flex justify-end overflow-y-scroll">
              <div className="flex w-[100px] text-xs">
                <p className="flex w-[50px] justify-center">
                  {showSelectToMigrateWindow ? t('Migrate') : t('Retry')}
                </p>
                <p className="flex w-[50px] justify-center">{t('Discard')}</p>
              </div>
            </div>
            <div className="my-2 flex justify-between overflow-y-scroll border-b border-b-tertiary pb-2">
              <div className="flex items-center gap-1 py-1 text-xs">
                {t('All items')}
              </div>
              <div className="flex w-[100px] items-center justify-around">
                <AllItemsCheckboxes
                  isChecked={isAllItemsSelected || isSomeItemsSelected}
                  isCheckIcon={isAllItemsSelected}
                  isMinusIcon={isSomeItemsSelected}
                  onSelectHandler={handleSelectAll}
                />
                <AllItemsCheckboxes
                  isChecked={!isAllItemsSelected || isNothingSelected}
                  isCheckIcon={isNothingSelected}
                  isMinusIcon={!isAllItemsSelected}
                  onSelectHandler={handleUnselectAll}
                />
              </div>
            </div>
          </div>

          <div className="flex-col divide-y divide-tertiary  overflow-y-scroll px-6">
            <ItemsList
              entitiesToRetryIds={conversationsToRetryIds}
              setEntitiesToRetryIds={(convIds: string[]) =>
                setConversationsToRetryIds(convIds)
              }
              failedMigratedEntities={failedMigratedConversations}
              getModelIcon={(conversation) => (
                <div className="flex items-center">
                  <ModelIcon
                    entity={modelsMap[conversation.model.id]}
                    entityId={conversation.model.id}
                    size={18}
                  />
                </div>
              )}
            />
            <ItemsList
              entitiesToRetryIds={promptsToRetryIds}
              setEntitiesToRetryIds={(promptIds: string[]) =>
                setPromptsToRetryIds(promptIds)
              }
              failedMigratedEntities={failedMigratedPrompts}
              getModelIcon={() => (
                <div className="flex items-center">
                  <IconBulb size={18} className="text-secondary" />
                </div>
              )}
              withPt={!!failedMigratedConversations.length}
            />
          </div>
          <footer className="flex flex-col items-center justify-end border-t border-t-tertiary px-6 pt-4">
            {!!(
              (!isChatsBackedUp && failedMigratedConversations.length) ||
              (!isPromptsBackedUp && failedMigratedPrompts.length)
            ) && (
              <div className="flex items-center gap-4">
                <div className="relative flex size-[18px] group-hover/file-item:flex">
                  <input
                    className="checkbox peer size-[18px] bg-transparent"
                    type="checkbox"
                    onClick={() => setDontWantBackup((prev) => !prev)}
                    readOnly
                    checked={dontWantBackup}
                  />
                  {dontWantBackup && (
                    <IconCheck
                      size={18}
                      className="pointer-events-none invisible absolute text-accent-primary peer-checked:visible"
                    />
                  )}
                </div>
                <p className="text-secondary">
                  {t(
                    "I don't want to backup conversations/prompts and I’m ready ",
                  )}
                  <span className="font-semibold">{t('TO LOSE DATA')}</span>
                </p>
              </div>
            )}
            <div className="mt-3 flex w-full justify-end">
              {!!failedMigratedPrompts.length && (
                <button
                  className="button button-secondary mr-3 flex h-[38px] min-w-[73px] items-center capitalize md:normal-case"
                  data-qa="skip-migration"
                  onClick={handleBackupPrompts}
                >
                  {isPromptsBackedUp ? (
                    <IconCircleCheck
                      size={18}
                      className="mr-3 text-accent-secondary"
                    />
                  ) : (
                    <IconDownload size={18} className="mr-3 text-secondary" />
                  )}
                  {!isScreenSmall && t('Backup')} {t('prompts')}
                </button>
              )}
              {!!failedMigratedConversations.length && (
                <button
                  className="button button-secondary mr-3 flex h-[38px] min-w-[73px] items-center capitalize md:normal-case"
                  data-qa="skip-migration"
                  onClick={handleBackupChats}
                >
                  {isChatsBackedUp ? (
                    <IconCircleCheck
                      size={18}
                      className="mr-3 text-accent-secondary"
                    />
                  ) : (
                    <IconDownload size={18} className="mr-3 text-secondary" />
                  )}
                  {!isScreenSmall && t('Backup')} {t('chats')}
                </button>
              )}
              <button
                className="button button-primary mr-3 flex h-[38px] items-center"
                data-qa="skip-migration"
                onClick={retryMigration}
                disabled={!isNextButtonEnabled}
              >
                {t('Next')}
              </button>
            </div>
          </footer>
        </div>
      </div>
      <p className="mt-6 text-secondary">
        {t('If you have a problem please ')}
        <button
          onClick={() => setIsReportIssueDialogOpen(true)}
          type="button"
          className="underline"
        >
          {t('contact us.')}
        </button>
      </p>
      {enabledFeatures.has(Feature.ReportAnIssue) &&
        isReportIssueDialogOpen && (
          <ReportIssueDialog
            onClose={() => {
              setIsReportIssueDialogOpen(false);
              router.replace(router.basePath);
            }}
          />
        )}
    </div>
  );
};
