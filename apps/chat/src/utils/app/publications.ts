import { ApiKeys, FeatureType } from '@/src/types/common';
import { SharingType } from '@/src/types/share';

import { constructPath } from './file';
import { EnumMapper } from './mappers';

export const isItemPublic = (id: string) => id.split('/')[1] === 'public';

export const createTargetUrl = (
  featureType: FeatureType,
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
    EnumMapper.getApiKeyByFeatureType(featureType),
    'public',
    publicPath,
    ...baseElements,
    ...lastElement,
  );
};

export const getPublicationId = (url: string) =>
  url.split('/').slice(-1).shift();
