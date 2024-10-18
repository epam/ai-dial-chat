import { useEffect } from 'react';

import { useRouter } from 'next/router';

import { getCommonPageProps } from '@/src/utils/server/get-common-page-props';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { MarketplaceActions } from '@/src/store/marketplace/marketplace.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import Loader from '@/src/components/Common/Loader';
import { UserMobile } from '@/src/components/Header/User/UserMobile';
import { Marketplace as MarketplaceView } from '@/src/components/Marketplace/Marketplace';
import { MarketplaceFilterbar } from '@/src/components/Marketplace/MarketplaceFilterbar';
import { MarketplaceHeader } from '@/src/components/Marketplace/MarketplaceHeader';

import { Feature } from '@epam/ai-dial-shared';

export default function Marketplace() {
  const dispatch = useAppDispatch();

  const isProfileOpen = useAppSelector(UISelectors.selectIsProfileOpen);

  const isMarketplaceEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.Marketplace),
  );

  const router = useRouter();
  useEffect(() => {
    if (!isMarketplaceEnabled) {
      router.push('/');
    }
  }, [isMarketplaceEnabled, router]);

  useEffect(() => {
    dispatch(MarketplaceActions.resetFiltering());
  }, [dispatch]);

  if (!isMarketplaceEnabled) return <Loader />;

  return (
    <div className="flex size-full flex-col sm:pt-0">
      <MarketplaceHeader />
      <div className="relative flex h-screen w-full grow overflow-hidden">
        <MarketplaceFilterbar />

        <MarketplaceView />

        {isProfileOpen && <UserMobile />}
      </div>
    </div>
  );
}

export const getServerSideProps = getCommonPageProps;
