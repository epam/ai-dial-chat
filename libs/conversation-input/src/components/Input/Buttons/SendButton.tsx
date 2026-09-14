import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  PrimaryIconButton,
} from '@epam/ai-dial-ui-kit';
import { IconArrowNarrowRight } from '@tabler/icons-react';
import { type FC } from 'react';

/** Props for the {@link SendButton} component. */
export interface SendButtonProps {
  onSend?: () => void;
  isDisabled?: boolean;
  /** Accessible label for the send button. */
  ariaLabel?: string;
}

/** Circular send button with tooltip and disabled state. */
export const SendButton: FC<SendButtonProps> = ({
  onSend,
  isDisabled = false,
  ariaLabel = 'Send message',
}) => {
  return (
    <PrimaryIconButton
      aria-label={ariaLabel}
      onClick={() => onSend?.()}
      disabled={isDisabled}
      icon={
        <IconArrowNarrowRight
          size={DIAL_ICON_SIZE.LG}
          className="rtl:scale-x-[-1]"
          stroke={DIAL_KIT_ICON_STROKE}
        />
      }
    />
  );
};
