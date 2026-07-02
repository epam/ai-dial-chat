import { IconPlus } from '@tabler/icons-react';
import React, { useCallback } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import {
  ConversationsActions,
  PromptsActions,
  PublicationActions,
} from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ConversationsSelectors,
  PublicationSelectors,
} from '@/src/store/selectors';

import { DEFAULT_CONVERSATION_NAME } from '@/src/constants/default-ui-settings';
import { HeaderI18nKeys } from '@/src/constants/i18n';

import { Spinner } from '@/src/components/Common/Spinner';

import { DialButton } from '@epam/ai-dial-ui-kit';

interface CreateNewEntityButtonProps {
  iconSize: number;
  tooltip: string;
  isDisabled?: boolean;
  showSpinner?: boolean;
  colorsClass?: string;
  onClick: () => void;
}

const CreateNewEntityButton: React.FC<CreateNewEntityButtonProps> = ({
  iconSize,
  tooltip,
  isDisabled,
  showSpinner,
  colorsClass = 'bg-accent-primary-alpha text-accent-primary hover:border-accent-primary',
  onClick,
}) => {
  const { t } = useTranslation(Translation.Header);

  return (
    <DialButton
      className="flex h-full items-center justify-center"
      aria-label={t(tooltip)}
      tooltipProps={{ isTriggerClickable: true, tooltip: t(tooltip) }}
      onClick={onClick}
      disabled={isDisabled}
      data-qa="new-entity"
      iconBefore={
        showSpinner ? (
          <Spinner
            size={iconSize + 6}
            className="cursor-pointer text-secondary md:mx-2"
          />
        ) : (
          <div
            className={classNames(
              'flex items-center justify-center rounded-full border border-transparent p-[2px]',
              colorsClass,
            )}
          >
            <IconPlus size={iconSize} />
          </div>
        )
      }
    />
  );
};

interface Props {
  iconSize: number;
}

export const CreateNewConversation: React.FC<Props> = ({ iconSize }) => {
  const dispatch = useAppDispatch();

  const areConversationsLoaded = useAppSelector(
    ConversationsSelectors.areConversationsUploaded,
  );
  const messageIsStreaming = useAppSelector(
    ConversationsSelectors.selectIsConversationsStreaming,
  );
  const selectedPublicationUrl = useAppSelector(
    PublicationSelectors.selectSelectedPublicationUrl,
  );

  const handleCreate = useCallback(() => {
    if (!areConversationsLoaded) return;
    dispatch(
      ConversationsActions.createNewConversations({
        names: [DEFAULT_CONVERSATION_NAME],
        headerCreateNew: true,
      }),
    );
    dispatch(ConversationsActions.resetSearch());
    dispatch(ConversationsActions.setIsStartedCustomViewerConversation(false));
    if (selectedPublicationUrl) {
      dispatch(PublicationActions.selectPublication({ url: null }));
    }
  }, [areConversationsLoaded, dispatch, selectedPublicationUrl]);

  return (
    <CreateNewEntityButton
      tooltip={HeaderI18nKeys.NewConversation}
      isDisabled={messageIsStreaming}
      onClick={handleCreate}
      iconSize={iconSize}
      showSpinner={!areConversationsLoaded}
      colorsClass={classNames(
        'bg-accent-secondary-alpha text-accent-secondary',
        !messageIsStreaming && 'hover:border-accent-secondary',
      )}
    />
  );
};

export const CreateNewPrompt: React.FC<Props> = ({ iconSize }) => {
  const dispatch = useAppDispatch();

  const handleCreate = useCallback(() => {
    dispatch(PromptsActions.setIsNewPromptCreating(true));
    dispatch(PromptsActions.resetSearch());
    dispatch(
      PromptsActions.setIsPromptModalOpen({
        isOpen: true,
        isInitModeEdit: true,
      }),
    );
    dispatch(PromptsActions.resetChosenPrompts());
  }, [dispatch]);

  return (
    <CreateNewEntityButton
      tooltip={HeaderI18nKeys.NewPrompt}
      onClick={handleCreate}
      iconSize={iconSize}
      colorsClass="bg-accent-tertiary-alpha text-accent-tertiary hover:border-accent-tertiary"
    />
  );
};
