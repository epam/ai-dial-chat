import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { memo, type FC } from 'react';

interface Props {
  bg: string;
  textColor: string;
  shortName: string | undefined;
  initialsClassName?: string;
}

const AvatarInitials: FC<Props> = ({
  bg,
  textColor,
  shortName,
  initialsClassName = 'dial-tiny-text',
}) => {
  return (
    <div
      className={mergeClasses(
        'flex size-[28px] flex-shrink-0 items-center justify-center rounded-full',
        initialsClassName,
      )}
      style={{ backgroundColor: bg, color: textColor }}
    >
      {shortName}
    </div>
  );
};

export default memo(AvatarInitials);
