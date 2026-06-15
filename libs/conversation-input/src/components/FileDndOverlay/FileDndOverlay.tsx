import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { IconFileDescription } from '@tabler/icons-react';
import type { FC } from 'react';
import type { FileDndOverlayProps } from '../../models/FileDndOverlay';

export const FileDndOverlay: FC<FileDndOverlayProps> = ({
  isVisible,
  title = 'Attach files',
  subtitle = 'Drop files here to attach them to message',
  iconClassName = 'text-accent-primary',
  titleClassName = 'heading-3 font-semibold',
  subtitleClassName = 'dial-small-text',
}) => {
  if (!isVisible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999] flex items-center justify-center bg-blackout backdrop-blur-sm">
      <div className="flex flex-col items-center text-center">
        <IconFileDescription size={100} className={iconClassName} />
        <span className={mergeClasses('mt-5', titleClassName)}>{title}</span>
        <span className={mergeClasses('mt-4', subtitleClassName)}>
          {subtitle}
        </span>
      </div>
    </div>
  );
};
