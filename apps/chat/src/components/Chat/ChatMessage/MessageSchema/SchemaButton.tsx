import classNames from 'classnames';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppSelector } from '@/src/store/hooks';

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

  return (
    <button
      data-no-context-menu
      key={option.const}
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
