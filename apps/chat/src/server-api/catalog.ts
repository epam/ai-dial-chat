import type {
  CatalogResponseDto,
  ListCatalogItemsRequest,
} from '@epam/chat-api-client';
import { catalogApi } from './api-client';

export const getCatalogItems = (
  params?: ListCatalogItemsRequest,
): Promise<CatalogResponseDto> => catalogApi.listCatalogItems(params);
