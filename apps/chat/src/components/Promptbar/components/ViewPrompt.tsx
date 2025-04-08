import { useCallback } from 'react';

import classNames from 'classnames';

import { usePromptActions } from '@/src/hooks/usePromptActions';
import { usePublicVersionGroupId } from '@/src/hooks/usePublicVersionGroupIdFromPublicEntity';
import { useTranslation } from '@/src/hooks/useTranslation';

import { Prompt } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import { useAppDispatch } from '@/src/store/hooks';
import { PromptsActions } from '@/src/store/prompts/prompts.reducers';

import { TemplateRenderer } from '@/src/components/Chat/ChatMessage/ChatMessageTemplatesModal/TemplateRenderer';
import { PublicVersionSelector } from '@/src/components/Chat/Publish/PublicVersionSelector';
import { PublicationControls } from '@/src/components/Chat/Publish/PublicationChatControls';

import { ViewPromptButtons } from './ViewPromptButtons';

import InsertPromptIcon from '@/public/images/icons/insert-prompt.svg';
import { PublishActions } from '@epam/ai-dial-shared';

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
  onClose: () => void;
}

export const ViewPrompt = ({ prompt, onEditMode }: Props) => {
  const { t } = useTranslation(Translation.PromptBar);

  const dispatch = useAppDispatch();

  const { publicVersionGroupId, isReviewEntity } =
    usePublicVersionGroupId(prompt);
  const { handleUse } = usePromptActions(prompt);

  const handleChangeSelectedVersion = useCallback(
    (newVersionId: string) => {
      dispatch(PromptsActions.selectPrompt({ promptId: newVersionId }));
    },
    [dispatch],
  );

  return (
    <>
      <ul className="mb-4 flex max-h-[435px] flex-col gap-4 overflow-auto">
        <PromptField valueClassName="line-clamp-2" label="Name" dataQa="name">
          {prompt.name}
        </PromptField>
        {prompt.description && (
          <PromptField label="Description" dataQa="description">
            {prompt.description}
          </PromptField>
        )}
        {prompt.content && (
          <PromptField label="Prompt" dataQa="content">
            <TemplateRenderer template={prompt.content} />
          </PromptField>
        )}
      </ul>
      <div className="flex items-center justify-between">
        <ViewPromptButtons prompt={prompt} onEditMode={onEditMode} />
        <div className="flex items-center gap-4">
          {isReviewEntity ? (
            <>
              <p
                className={classNames(
                  prompt.publicationInfo?.action === PublishActions.DELETE &&
                    'text-error',
                )}
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
              <button
                onClick={handleUse}
                className="button button-primary flex items-center gap-2"
                data-qa="use-prompt"
              >
                <InsertPromptIcon className="size-[18px]" />
                <span className="hidden md:block">{t('Use prompt')}</span>
                <span className="block md:hidden">{t('Use')}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
};
