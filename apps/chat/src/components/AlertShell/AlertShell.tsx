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
 * The kit `StateScreen` draws the icon badge, `h1`, description and action.
 * Both callers replace the whole view, so this is page state rather than a
 * live update: it carries no live-region role (one that mounts with its text
 * is announced unreliably anyway). The auto-focused action moves focus into
 * the `section` named by the heading, which is what gets announced.
 */
const AlertShell: FC<Props> = ({
  icon,
  heading,
  message,
  actionLabel,
  onAction,
}) => (
  <div className="size-full">
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
