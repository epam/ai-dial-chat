import { PrimaryButton, StateScreen } from '@epam/ai-dial-ui-kit';
import { memo, type FC, type ReactNode } from 'react';

interface Props {
  icon: ReactNode;
  heading: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
}

/**
 * Full-screen alert layout shared by ErrorFallback and NewVersionFallback.
 * The kit `StateScreen` draws the icon badge, `h1`, description and action;
 * the `role="alert"` wrapper keeps the replacement screen announced.
 */
const AlertShell: FC<Props> = ({
  icon,
  heading,
  message,
  actionLabel,
  onAction,
}) => (
  <div role="alert" className="size-full">
    <StateScreen
      icon={icon}
      title={heading}
      description={message}
      action={
        <PrimaryButton autoFocus label={actionLabel} onClick={onAction} />
      }
    />
  </div>
);

export default memo(AlertShell);
