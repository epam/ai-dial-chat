import { DIAL_ICON_SIZE, StaticIconButton } from '@epam/ai-dial-ui-kit';
import { IconPlaystationSquare } from '@tabler/icons-react';
import { type FC } from 'react';

interface Props {
  onStop?: () => void;
  /** Accessible label for the stop button. */
  ariaLabel?: string;
}

/** Square stop-streaming button. */
export const StopButton: FC<Props> = ({
  onStop,
  ariaLabel = 'Stop streaming',
}) => {
  return (
    <StaticIconButton
      icon={<IconPlaystationSquare size={DIAL_ICON_SIZE.LG} />}
      onClick={() => onStop?.()}
      aria-label={ariaLabel}
    />
  );
};
