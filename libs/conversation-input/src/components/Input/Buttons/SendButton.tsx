import { DIAL_ICON_SIZE, PrimaryIconButton } from '@epam/ai-dial-ui-kit';
import { IconArrowNarrowRight } from '@tabler/icons-react';
import { type FC } from 'react';

/** Props for the {@link SendButton} component. */
export interface SendButtonProps {
  onSend?: () => void;
  isDisabled?: boolean;
  /** Accessible label for the send button. */
  ariaLabel?: string;
  /** Whether the button is in the process of exiting (e.g., during an animation). */
  isExiting?: boolean;
}

/** Animated circular send button with tooltip and disabled state. */
export const SendButton: FC<SendButtonProps> = ({
  onSend,
  isDisabled = false,
  ariaLabel = 'Send message',
  isExiting = false,
}) => {
  return (
    <PrimaryIconButton
      aria-label={ariaLabel}
      onClick={() => onSend?.()}
      disabled={isDisabled}
      aria-hidden={isExiting}
      icon={
        <IconArrowNarrowRight
          size={DIAL_ICON_SIZE.LG}
          className="rtl:scale-x-[-1]"
        />
      }
    />
  );
};
