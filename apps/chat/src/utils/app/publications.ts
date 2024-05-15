import { ApiKeys, ShareEntity } from '@/src/types/common';
import { SharingType } from '@/src/types/share';

import { constructPath } from './file';

export const isItemPublic = (id: string) => id.split('/')[1] === 'public';

export const createTargetUrl = (
  apiKey: ApiKeys,
  publicPath: string,
  entity: ShareEntity,
  type: SharingType,
) => {
  const baseElements =
    type === SharingType.PromptFolder || type === SharingType.ConversationFolder
      ? entity.id.split('/').slice(2, -1)
      : '';

  const lastElement = entity.id.split('/').slice(-1);

  return constructPath(
    apiKey,
    'public',
    publicPath,
    ...baseElements,
    ...lastElement,
  );
};
