import { IconPlus } from '@tabler/icons-react';
import { useCallback } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PromptsActions } from '@/src/store/prompts/prompts.reducers';
import { PublicationActions } from '@/src/store/publication/publication.reducers';

import { DEFAULT_CONVERSATION_NAME } from '@/src/constants/default-ui-settings';

import { Spinner } from '@/src/components/Common/Spinner';

import Tooltip from '../Common/Tooltip';

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
    <Tooltip isTriggerClickable tooltip={t(tooltip)}>
      <button
        className="flex h-full items-center justify-center disabled:cursor-not-allowed"
        aria-label={t(tooltip)}
        onClick={onClick}
        disabled={isDisabled}
        data-qa="new-entity"
      >
        {showSpinner ? (
          <Spinner
            size={iconSize + 6}
            className="cursor-pointer text-secondary md:mx-2"
          />
        ) : (
          <div
            className={classNames(
              'flex items-center justify-center rounded-full border border-transparent p-[2px]',
              isDisabled ? 'cursor-not-allowed' : 'cursor-pointer',
              colorsClass,
            )}
          >
            <IconPlus
              className={isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}
              size={iconSize}
            />
          </div>
        )}
      </button>
    </Tooltip>
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
    dispatch(PublicationActions.selectPublication(null));
  }, [areConversationsLoaded, dispatch]);

  return (
    <CreateNewEntityButton
      tooltip="New conversation"
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
      tooltip="New prompt"
      onClick={handleCreate}
      iconSize={iconSize}
      colorsClass="bg-accent-tertiary-alpha text-accent-tertiary hover:border-accent-tertiary"
    />
  );
};
