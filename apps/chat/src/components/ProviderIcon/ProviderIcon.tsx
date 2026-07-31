import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { memo, useCallback, useState, type FC } from 'react';

interface Props {
  providerId: string;
}

export const getProviderIconUrl = (providerId: string): string => {
  const iconId = providerId.replace(/[1-9]\d*$/, '');

  return `https://authjs.dev/img/providers/${encodeURIComponent(iconId)}.svg`;
};

const ProviderIcon: FC<Props> = ({ providerId }) => {
  const [iconFailed, setIconFailed] = useState(false);
  const handleProviderIconError = useCallback(() => setIconFailed(true), []);

  return (
    <img
      src={getProviderIconUrl(providerId)}
      alt=""
      aria-hidden="true"
      className={mergeClasses('size-5 shrink-0', iconFailed && 'hidden')}
      onError={handleProviderIconError}
    />
  );
};

export default memo(ProviderIcon);
