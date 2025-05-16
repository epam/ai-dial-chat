import { useEffect, useRef } from 'react';

import classNames from 'classnames';

import { ConversationsActions } from '@/src/store/conversations/conversations.reducers';
import { ConversationsSelectors } from '@/src/store/conversations/conversations.selectors';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';

import { FormSchemaButtonOption, MessageFormValue } from '@epam/ai-dial-shared';

interface Props {
  option: FormSchemaButtonOption;
  showSelected: boolean;
  disabled: boolean;
  formValue?: MessageFormValue;
  className?: string;
  onClick: (option: FormSchemaButtonOption) => void;
}

export const SchemaButton: React.FC<Props> = ({
  option,
  showSelected,
  disabled,
  formValue,
  className,
  onClick,
}) => {
  const isPlayback = useAppSelector(
    ConversationsSelectors.selectIsPlaybackSelectedConversations,
  );

  const selectedAction = useAppSelector(ConversationsSelectors.selectAction);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (option.title === selectedAction) {
      buttonRef.current?.click();
      dispatch(ConversationsActions.selectAction(null));
    }
  }, [option.title, selectedAction, dispatch]);

  return (
    <button
      data-no-context-menu
      key={`${option.const}`}
      ref={buttonRef}
      onClick={isPlayback ? undefined : () => onClick(option)}
      className={classNames('chat-button max-w-full truncate', className, {
        'button-accent-primary':
          showSelected && Object.values(formValue ?? {}).includes(option.const),
        'cursor-not-allowed': disabled,
      })}
      disabled={isPlayback ? false : disabled}
    >
      {option.title}
    </button>
  );
};
