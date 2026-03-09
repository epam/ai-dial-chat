import { isMarketplaceEntityPublic } from '@/src/utils/app/application';
import { isMyApplication } from '@/src/utils/app/id';
import { canWriteSharedWithMe } from '@/src/utils/app/share';

import { MarketplaceEntity } from '@/src/types/marketplace';

import { useAppSelector } from '@/src/store/hooks';
import { AuthSelectors } from '@/src/store/selectors';

export const useHasDeployAccess = (entity?: MarketplaceEntity) => {
  const isAdmin = useAppSelector(AuthSelectors.selectIsAdmin);

  if (!entity) {
    return false;
  }

  const isMyApp = isMyApplication(entity);
  const canWrite = canWriteSharedWithMe(entity);
  const isPublicApp = isMarketplaceEntityPublic(entity);

  return isMyApp || canWrite || (isPublicApp && isAdmin);
};
