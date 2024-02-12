import { IconBulb, IconCheck, IconMinus } from '@tabler/icons-react';
import { ReactElement, useState } from 'react';
import { useDispatch } from 'react-redux';

import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';

import classNames from 'classnames';

import { Conversation } from '@/src/types/chat';
import { Prompt } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import { ConversationsActions } from '@/src/store/conversations/conversations.reducers';
import { useAppSelector } from '@/src/store/hooks';
import { ImportExportActions } from '@/src/store/import-export/importExport.reducers';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { PromptsActions } from '@/src/store/prompts/prompts.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

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

  return (
    !!failedMigratedEntities.length && (
      <div className={classNames('mt-2', withPt && 'pt-2')}>
        <ul className="flex flex-col gap-0.5">
          {failedMigratedEntities.map((entity) => (
            <li
              className="relative flex h-[30px] items-center justify-between rounded"
              key={entity.id}
            >
              <div className="flex">
                {getModelIcon(entity)}
                <p className="ml-2">{entity.name}</p>
              </div>
              <div className="flex w-[100px] items-center justify-around">
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
    )
  );
};

interface Props {
  failedMigratedConversations: Conversation[];
  failedMigratedPrompts: Prompt[];
}

export const MigrationFailedWindow = ({
  failedMigratedConversations,
  failedMigratedPrompts,
}: Props) => {
  const { t } = useTranslation(Translation.Common);

  const dispatch = useDispatch();

  const router = useRouter();

  const [conversationsToRetryIds, setConversationsToRetryIds] = useState(() =>
    failedMigratedConversations.map((conv) => conv.id),
  );
  const [promptsToRetryIds, setPromptsToRetryIds] = useState(() =>
    failedMigratedPrompts.map((prompt) => prompt.id),
  );

  const [isReportIssueDialogOpen, setIsReportIssueDialogOpen] = useState(false);

  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

  const onSkipAll = () => {
    dispatch(
      ConversationsActions.skipFailedMigratedConversations({
        idsToMarkAsMigrated: failedMigratedConversations.map((conv) => conv.id),
      }),
    );
    dispatch(
      PromptsActions.skipFailedMigratedPrompts({
        idsToMarkAsMigrated: failedMigratedPrompts.map((prompt) => prompt.id),
      }),
    );
  };

  const onRetry = () => {
    const failedMigratedConversationIds = failedMigratedConversations.map(
      (conv) => conv.id,
    );
    const failedMigratedPromptIds = failedMigratedPrompts.map(
      (conv) => conv.id,
    );

    dispatch(ImportExportActions.exportLocalStorageEntities());
    dispatch(
      ConversationsActions.skipFailedMigratedConversations({
        idsToMarkAsMigrated: failedMigratedConversationIds.filter(
          (id) => !conversationsToRetryIds.includes(id),
        ),
      }),
    );
    dispatch(
      PromptsActions.skipFailedMigratedPrompts({
        idsToMarkAsMigrated: failedMigratedPromptIds.filter(
          (id) => !promptsToRetryIds.includes(id),
        ),
      }),
    );
    dispatch(ConversationsActions.migrateConversations());
    dispatch(PromptsActions.migratePrompts());
  };

  const onSelectAll = () => {
    setConversationsToRetryIds(
      failedMigratedConversations.map((conv) => conv.id),
    );
    setPromptsToRetryIds(failedMigratedPrompts.map((prompt) => prompt.id));
  };

  const onUnselectAll = () => {
    setConversationsToRetryIds([]);
    setPromptsToRetryIds([]);
  };

  return (
    <div className="flex size-full flex-col items-center justify-center">
      <div className="m-2 flex max-w-[523px] flex-col divide-y divide-tertiary rounded bg-layer-2 pb-4 pt-6">
        <div className="flex flex-col pb-4">
          <div className="px-6">
            <h1 className="text-base font-semibold">
              {t('Some items failed to migrate, retry migration?')}
            </h1>
            <p className="mt-2 text-secondary">
              {t(
                'Retry migration or discard the unsuccessfully migrated conversations',
              )}
              <wbr />
              /
              <wbr />
              {t('prompts. All discarded items will be ')}
              <strong>{t('PERMANENTLY LOST')}</strong>.
            </p>
            <div className="mt-4 flex justify-end">
              <div className="flex w-[100px] text-xs">
                <p className="flex w-[50px] justify-center">{t('Retry')}</p>
                <p className="flex w-[50px] justify-center">{t('Discard')}</p>
              </div>
            </div>
            <div className="my-2 flex justify-between border-b-[1px] border-b-tertiary pb-2">
              <div className="flex items-center gap-1 py-1 text-xs">
                {t('All items')}
              </div>
              <div className="flex w-[100px] justify-around">
                <div className="relative flex size-[18px] group-hover/file-item:flex">
                  <input
                    className="checkbox peer size-[18px] bg-transparent"
                    type="checkbox"
                    onClick={onUnselectAll}
                    readOnly
                    checked={
                      conversationsToRetryIds.length !== 0 ||
                      promptsToRetryIds.length !== 0
                    }
                  />
                  <IconMinus
                    size={18}
                    className="pointer-events-none invisible absolute text-accent-primary peer-checked:visible"
                  />
                </div>
                <div className="relative flex size-[18px] group-hover/file-item:flex">
                  <input
                    className="checkbox peer size-[18px] bg-transparent"
                    type="checkbox"
                    onClick={onSelectAll}
                    readOnly
                    checked={
                      conversationsToRetryIds.length !==
                        failedMigratedConversations.length ||
                      promptsToRetryIds.length !== failedMigratedPrompts.length
                    }
                  />
                  <IconMinus
                    size={18}
                    className="pointer-events-none invisible absolute text-accent-primary peer-checked:visible"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="max-h-[45vh] flex-col divide-y divide-tertiary overflow-auto px-6">
            <ItemsList
              entitiesToRetryIds={conversationsToRetryIds}
              setEntitiesToRetryIds={(convIds: string[]) =>
                setConversationsToRetryIds(convIds)
              }
              failedMigratedEntities={failedMigratedConversations}
              getModelIcon={(conversation) => (
                <ModelIcon
                  entity={modelsMap[conversation.model.id]}
                  entityId={conversation.model.id}
                  size={18}
                />
              )}
            />
            <ItemsList
              entitiesToRetryIds={promptsToRetryIds}
              setEntitiesToRetryIds={(promptIds: string[]) =>
                setPromptsToRetryIds(promptIds)
              }
              failedMigratedEntities={failedMigratedPrompts}
              getModelIcon={() => (
                <IconBulb size={18} className="text-secondary" />
              )}
              withPt
            />
          </div>
        </div>
        <footer className="flex items-center justify-end px-6 pt-4">
          <button
            className="button button-secondary mr-3 flex h-[38px] min-w-[73px] items-center"
            data-qa="skip-migration"
            onClick={onSkipAll}
          >
            {t('Continue without backup')}
          </button>
          <button
            className="button button-primary flex h-[38px] items-center"
            data-qa="try-migration-again"
            onClick={onRetry}
          >
            {t('Backup to disk and continue')}
          </button>
        </footer>
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
      {enabledFeatures.has(Feature.ReportAnIssue) && (
        <ReportIssueDialog
          isOpen={isReportIssueDialogOpen}
          onClose={() => {
            setIsReportIssueDialogOpen(false);
            router.replace(router.basePath);
          }}
        />
      )}
    </div>
  );
};
