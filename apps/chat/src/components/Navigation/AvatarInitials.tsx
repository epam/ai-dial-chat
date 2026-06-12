import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { memo, type FC } from 'react';

interface Props {
  shortName: string | undefined;
  colorClassName?: string;
  initialsClassName?: string;
}

const AvatarInitials: FC<Props> = ({
  shortName,
  colorClassName = 'bg-avatar-bg text-avatar-initials',
  initialsClassName = 'dial-tiny-text',
}) => {
  return (
    <div
      className={mergeClasses(
        'flex size-[28px] flex-shrink-0 items-center justify-center rounded-full',
        colorClassName,
        initialsClassName,
      )}
    >
      {shortName}
    </div>
  );
};

export default memo(AvatarInitials);
