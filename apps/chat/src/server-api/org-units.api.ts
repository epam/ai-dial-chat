import type { OrgUnitsResponseDto } from '@epam/ai-dial-chat-api-client';
import { orgUnitsApi } from './api-client';

/** The DIAL Core org units visible to the current user; `enabled` is false while org units are off. */
export const listOrgUnits = (): Promise<OrgUnitsResponseDto> =>
  orgUnitsApi.listOrgUnits();
