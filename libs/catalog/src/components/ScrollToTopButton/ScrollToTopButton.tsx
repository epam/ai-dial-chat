import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  FabButton,
} from '@epam/ai-dial-ui-kit';
import { IconArrowNarrowUp } from '@tabler/icons-react';
import { FC } from 'react';

/** Props for ScrollToTopButton. */
interface ScrollToTopButtonProps {
  /** Accessible name and tooltip text of the button. */
  label: string;
  /** Called when the button is activated. */
  onClick: () => void;
  /** CSS class applied to the button. */
  className?: string;
}

/** Floating button that returns a scrolled view to its top. */
export const ScrollToTopButton: FC<ScrollToTopButtonProps> = ({
  label,
  onClick,
  className,
}) => (
  <FabButton
    icon={
      <IconArrowNarrowUp
        size={DIAL_ICON_SIZE.LG}
        stroke={DIAL_KIT_ICON_STROKE}
        aria-hidden
      />
    }
    aria-label={label}
    tooltipProps={{ tooltip: label }}
    onClick={onClick}
    className={className}
  />
);
