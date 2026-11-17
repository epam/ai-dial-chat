import type { OrgUnitsResponseDto } from '@epam/ai-dial-chat-api-client';
import { orgUnitsApi } from './api-client';

/**
 * The DIAL Core org units visible to the current user with the caller's permissions in each.
 * `enabled` is false while org units are off in Core; `hasAdminAccess` is true for a DIAL admin.
 */
export const listOrgUnits = (): Promise<OrgUnitsResponseDto> =>
  orgUnitsApi.listOrgUnits();
