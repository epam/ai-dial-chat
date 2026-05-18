import { mergeClasses } from '@epam/chat-shared';
import { FC } from 'react';

interface MessageSourceProps {
  label: string;
  className?: string;
  onClick?: () => void;
}

export const MessageSource: FC<MessageSourceProps> = ({
  label,
  className,
  onClick,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={mergeClasses(
        'relative flex h-6 items-center justify-center px-2',
        'border-secondary bg-neutral rounded-[4px] border border-solid',
        'hover:border-accent-primary hover:bg-accent-primary-alpha',
        'active:border-accent-primary active:bg-accent-primary-alpha',
        'outline-none focus-visible:outline focus-visible:outline-1',
        'focus-visible:outline-offset-[3px] focus-visible:outline-[var(--stroke-focus,#EEF1F7)]',
        'text-xxs text-primary cursor-pointer whitespace-nowrap leading-3',
        className,
      )}
    >
      {label}
    </button>
  );
};

export default MessageSource;
