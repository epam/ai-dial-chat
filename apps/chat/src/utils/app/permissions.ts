import { isEntityIdLocal } from './id';

import { Entity, SharePermission } from '@epam/ai-dial-shared';

export const isEntityReadOnly = (entity: Entity) =>
  !entity.permissions?.includes(SharePermission.WRITE) &&
  !isEntityIdLocal(entity);
