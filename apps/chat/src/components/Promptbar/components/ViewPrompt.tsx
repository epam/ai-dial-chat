import { useCallback } from 'react';

import classNames from 'classnames';

import { useMenuItemHandler } from '@/src/hooks/useHandler';
import { usePromptActions } from '@/src/hooks/usePromptActions';
import { usePublicVersionGroupId } from '@/src/hooks/usePublicVersionGroupIdFromPublicEntity';
import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';

import { ScreenState } from '@/src/types/common';
import { Prompt } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import { PromptsActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ConversationsSelectors,
  ModelsSelectors,
  PromptsSelectors,
} from '@/src/store/selectors';

import { TemplateRenderer } from '@/src/components/Chat/ChatMessage/ChatMessageTemplatesModal/TemplateRenderer';
import { PublicVersionSelector } from '@/src/components/Chat/Publish/PublicVersionSelector';
import { PublicationControls } from '@/src/components/Chat/Publish/PublicationControls/PublicationControls';

import { ViewPromptButtons } from './ViewPromptButtons';

import InsertPromptIcon from '@/public/images/icons/insert-prompt.svg';
import { PublishActions } from '@epam/ai-dial-shared';
import { DialPrimaryButton } from '@epam/ai-dial-ui-kit';

interface PromptFieldProps {
  children: React.ReactNode;
  label: string;
  dataQa: string;
  valueClassName?: string;
}

const PromptField: React.FC<PromptFieldProps> = ({
  children,
  label,
  dataQa,
  valueClassName,
}) => {
  const { t } = useTranslation(Translation.PromptBar);

  return (
    <li className="flex gap-2.5">
      <p
        className="mb-1 flex min-w-28 text-secondary"
        data-qa={`prompt-${dataQa}-label`}
      >
        {`${t(label)}: `}
      </p>
      <p
        className={classNames('overflow-hidden break-words', valueClassName)}
        data-qa={`prompt-${dataQa}`}
      >
        {children}
      </p>
    </li>
  );
};

interface Props {
  prompt: Prompt;
  onEditMode: () => void;
}

export const ViewPrompt = ({ prompt, onEditMode }: Props) => {
  const { t } = useTranslation(Translation.PromptBar);

  const dispatch = useAppDispatch();
  const screenState = useScreenState();

  const isConversationBlocksInput = useAppSelector(
    ConversationsSelectors.selectIsSelectedConversationBlocksInput,
  );
  const selectedConversations = useAppSelector(
    ConversationsSelectors.selectSelectedConversations,
  );
  const installedModelIds = useAppSelector(
    ModelsSelectors.selectInstalledModelIds,
  );
  const { isSelectedPromptApproveRequiredResource } = useAppSelector(
    PromptsSelectors.selectSelectedPromptId,
  );

  const publicVersionGroupId = usePublicVersionGroupId(prompt);

  const { handleUse } = usePromptActions(prompt);

  const handleChangeSelectedVersion = useCallback(
    (newVersionId: string) => {
      dispatch(PromptsActions.selectPrompt({ promptId: newVersionId }));
    },
    [dispatch],
  );

  const areModelsInstalled = selectedConversations.every((conv) =>
    installedModelIds.has(conv.model.id),
  );
  const disableUsePrompt =
    isConversationBlocksInput ||
    !areModelsInstalled ||
    !selectedConversations.length;

  const onUse = useMenuItemHandler(handleUse, undefined);

  return (
    <>
      <ul className="flex max-h-[435px] flex-col gap-4 overflow-y-auto px-3 pb-4 md:px-6">
        <PromptField label="Name" dataQa="name">
          {prompt.name}
        </PromptField>
        {prompt.description && (
          <PromptField
            label="Description"
            dataQa="description"
            valueClassName="whitespace-pre-wrap"
          >
            {prompt.description}
          </PromptField>
        )}
        {prompt.content && (
          <PromptField
            label="Prompt"
            dataQa="content"
            valueClassName="whitespace-pre-wrap"
          >
            <TemplateRenderer template={prompt.content} />
          </PromptField>
        )}
      </ul>
      <div className="flex items-center justify-between border-t border-t-tertiary px-3 pt-4 md:px-6">
        <ViewPromptButtons prompt={prompt} onEditMode={onEditMode} />
        <div className="flex items-center gap-4">
          {isSelectedPromptApproveRequiredResource ? (
            <>
              <p
                className={classNames(
                  prompt.publicationInfo?.action === PublishActions.DELETE &&
                    'text-error',
                )}
                data-qa="version"
              >
                {t('v.')} {prompt.publicationInfo?.version}
              </p>
              <PublicationControls entity={prompt} />
            </>
          ) : (
            <>
              {publicVersionGroupId && (
                <PublicVersionSelector
                  publicVersionGroupId={publicVersionGroupId}
                  onChangeSelectedVersion={handleChangeSelectedVersion}
                />
              )}
              <DialPrimaryButton
                onClick={onUse}
                disabled={disableUsePrompt}
                data-qa="use-prompt"
                iconBefore={<InsertPromptIcon className="size-[18px]" />}
                label={
                  screenState <= ScreenState.SM ? t('Use') : t('Use prompt')
                }
              />
            </>
          )}
        </div>
      </div>
    </>
  );
};
