import { useEffect, useRef } from 'react';

import classNames from 'classnames';

import { ConversationsActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ConversationsSelectors } from '@/src/store/selectors';

import { FormSchemaButtonOption, MessageFormValue } from '@epam/ai-dial-shared';
import { DialButton } from '@epam/ai-dial-ui-kit';

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
    <DialButton
      data-no-context-menu
      key={`${option.const}`}
      ref={buttonRef}
      onClick={isPlayback ? undefined : () => onClick(option)}
      className={classNames('chat-button max-w-full', className, {
        'button-accent-primary':
          showSelected && Object.values(formValue ?? {}).includes(option.const),
      })}
      textClassName="truncate"
      disabled={isPlayback ? false : disabled}
      label={option.title}
    />
  );
};
