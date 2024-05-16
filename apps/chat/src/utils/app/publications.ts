import { ApiKeys } from '@/src/types/common';
import { SharingType } from '@/src/types/share';

import { constructPath } from './file';

export const isItemPublic = (id: string) => id.split('/')[1] === 'public';

export const createTargetUrl = (
  apiKey: ApiKeys,
  publicPath: string,
  id: string,
  type?: SharingType,
) => {
  const baseElements =
    type === SharingType.PromptFolder || type === SharingType.ConversationFolder
      ? id.split('/').slice(2, -1)
      : '';

  const lastElement = id.split('/').slice(-1);

  return constructPath(
    apiKey,
    'public',
    publicPath,
    ...baseElements,
    ...lastElement,
  );
};
