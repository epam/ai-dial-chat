import { ApiUtils } from '../utils/server/api';

export enum MarketplaceQueryParams {
  fromConversation = 'fromConversation',
}

export const compareIdWithQueryParamId = (
  id: string,
  queryParamId: string | null,
) => ApiUtils.encodeApiUrl(id) === queryParamId;
