import { PrimaryButton } from '@epam/ai-dial-ui-kit';
import { memo, type FC, type ReactNode } from 'react';

interface Props {
  icon: ReactNode;
  heading: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
}

/** Full-screen alert layout shared by ErrorFallback and NewVersionFallback. */
const AlertShell: FC<Props> = ({
  icon,
  heading,
  message,
  actionLabel,
  onAction,
}) => (
  <div
    role="alert"
    className="flex size-full flex-col items-center justify-center gap-4 p-6 text-center"
  >
    {icon}
    <h2>{heading}</h2>
    <p className="text-secondary">{message}</p>
    <PrimaryButton autoFocus label={actionLabel} onClick={onAction} />
  </div>
);

export default memo(AlertShell);
