import { IconBulb, IconFileArrowRight } from '@tabler/icons-react';
import { ReactElement, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';

import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';

import classNames from 'classnames';

import { Conversation } from '@/src/types/chat';
import { Prompt } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import { ConversationsActions } from '@/src/store/conversations/conversations.reducers';
import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { PromptsActions } from '@/src/store/prompts/prompts.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { ReportIssueDialog } from '@/src/components/Chat/ReportIssueDialog';
import { ModelIcon } from '@/src/components/Chatbar/components/ModelIcon';
import { reportAnIssueHash } from '@/src/components/Common/FooterMessage';
import { EntityMarkdownDescription } from '@/src/components/Common/MarkdownDescription';
import Tooltip from '@/src/components/Common/Tooltip';

import { Feature } from '@epam/ai-dial-shared';

interface ItemsListProps<T> {
  failedMigratedEntities: T[];
  skippedEntityIds: string[];
  setSkippedEntityIds: (ids: string[]) => void;
  onExport: (entity: T) => void;
  getModelIcon: (entity: T) => ReactElement;
}

const ItemsList = <T extends Conversation | Prompt>({
  skippedEntityIds,
  setSkippedEntityIds,
  onExport,
  failedMigratedEntities,
  getModelIcon,
}: ItemsListProps<T>) => {
  const { t } = useTranslation(Translation.Common);

  return (
    !!failedMigratedEntities.length && (
      <div className="mt-4 max-h-[30vh] overflow-auto px-6">
        <div className="flex items-center gap-1 py-1 text-xs text-secondary">
          {t('Conversations')}
        </div>
        <ul className="flex flex-col gap-0.5">
          {failedMigratedEntities.map((entity) => (
            <li
              className={classNames(
                'relative flex h-[30px] items-center rounded px-3 pr-[75px]',
                skippedEntityIds.includes(entity.id)
                  ? 'bg-layer-3'
                  : 'hover:bg-accent-primary-alpha',
              )}
              key={entity.id}
            >
              {getModelIcon(entity)}
              <p className="ml-2">{entity.name}</p>
              <div className="absolute right-3 flex items-center gap-2">
                {!skippedEntityIds.includes(entity.id) ? (
                  <>
                    <button
                      onClick={() =>
                        setSkippedEntityIds([...skippedEntityIds, entity.id])
                      }
                      className="text-accent-primary"
                    >
                      {t('Skip')}
                    </button>
                    <IconFileArrowRight
                      onClick={() => onExport(entity)}
                      stroke={1.5}
                      className="text-secondary hover:text-accent-primary"
                      cursor="pointer"
                      size={18}
                    />
                  </>
                ) : (
                  <button
                    onClick={() =>
                      setSkippedEntityIds(
                        skippedEntityIds.filter((id) => id !== entity.id),
                      )
                    }
                    className="text-accent-primary"
                  >
                    {t('Restore')}
                  </button>
                )}
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

  const [isReportIssueDialogOpen, setIsReportIssueDialogOpen] = useState(false);
  const [skippedConversationIds, setSkippedConversationIds] = useState<
    string[]
  >([]);
  const [skippedPromptIds, setSkippedPromptIds] = useState<string[]>([]);

  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;

      if (hash === reportAnIssueHash) {
        setIsReportIssueDialogOpen(true);
      }
    };

    handleHash();

    window.addEventListener('hashchange', handleHash);

    return () => {
      window.removeEventListener('hashchange', handleHash);
    };
  }, []);

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
    dispatch(
      ConversationsActions.skipFailedMigratedConversations({
        idsToMarkAsMigrated: skippedConversationIds,
      }),
    );
    dispatch(
      PromptsActions.skipFailedMigratedPrompts({
        idsToMarkAsMigrated: skippedPromptIds,
      }),
    );
    dispatch(ConversationsActions.migrateConversations());
    dispatch(PromptsActions.migratePrompts());
  };

  return (
    <div className="flex size-full items-center justify-center">
      <div className="m-2 flex w-[523px] flex-col divide-y divide-tertiary rounded bg-layer-2 pb-4 pt-6">
        <div className="flex flex-col pb-4">
          <h1 className="px-6 text-base font-semibold">
            {t('Migration failed')}
          </h1>
          <p className="mt-2 px-6 text-secondary">
            Retry migration or skip the unsuccessfully migrated conversations
            <wbr />
            /
            <wbr />
            prompts. Skipped conversations
            <wbr />
            /
            <wbr />
            prompts will be permanently lost.
          </p>

          <ItemsList
            skippedEntityIds={skippedConversationIds}
            setSkippedEntityIds={setSkippedConversationIds}
            onExport={(conversation) =>
              // TODO: fix it when https://github.com/epam/ai-dial-chat/issues/640 will be resolved
              dispatch(
                ConversationsActions.exportConversation({
                  conversationId: conversation.id,
                }),
              )
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
            skippedEntityIds={skippedPromptIds}
            setSkippedEntityIds={setSkippedPromptIds}
            onExport={(prompt) =>
              // TODO: fix it when https://github.com/epam/ai-dial-chat/issues/640 will be resolved
              dispatch(
                PromptsActions.exportPrompt({
                  promptId: prompt.id,
                }),
              )
            }
            failedMigratedEntities={failedMigratedPrompts}
            getModelIcon={() => (
              <IconBulb size={18} className="text-secondary" />
            )}
          />
        </div>
        <footer className="flex items-center justify-between gap-3 px-6 pt-4">
          <div className="flex items-center">
            <Tooltip
              tooltip={
                <EntityMarkdownDescription>
                  Export all
                </EntityMarkdownDescription>
              }
            >
              <div
                onClick={() => {
                  // TODO: fix it when https://github.com/epam/ai-dial-chat/issues/640 will be resolved
                  dispatch(ConversationsActions.exportConversations());
                  dispatch(PromptsActions.exportPrompts());
                }}
                className="group mr-2 cursor-pointer rounded p-[5px] hover:bg-accent-primary-alpha"
              >
                <IconFileArrowRight
                  size={24}
                  stroke={1.5}
                  className="text-secondary group-hover:text-accent-primary"
                />
              </div>
            </Tooltip>
            <p className="text-xs text-secondary">
              In case of problems, please export conversations
              <wbr />
              /
              <wbr />
              prompts and{' '}
              <a href="/#reportAnIssue">
                <u>
                  <strong>report an issue</strong>
                </u>
              </a>
              .
            </p>
          </div>
          <button
            className="button button-secondary flex h-[38px] min-w-[73px] items-center"
            data-qa="skip-migration"
            onClick={onSkipAll}
          >
            {t('Skip all')}
          </button>
          <button
            className="button button-primary flex h-[38px] items-center"
            data-qa="try-migration-again"
            onClick={onRetry}
          >
            {t('Retry')}
          </button>
        </footer>
      </div>
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
