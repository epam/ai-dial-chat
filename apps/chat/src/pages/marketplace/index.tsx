import { useEffect } from 'react';

import { useRouter } from 'next/router';

import { getCommonPageProps } from '@/src/utils/server/get-common-page-props';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { getLayout } from '@/src/pages/_app';

import { ChatModalsManager } from '@/src/components/Chat/ChatModalsManager';
import Loader from '@/src/components/Common/Loader';
import { Marketplace as MarketplaceView } from '@/src/components/Marketplace/Marketplace';
import { MarketplaceFilterbar } from '@/src/components/Marketplace/MarketplaceFilterbar';
import { MarketplaceHeader } from '@/src/components/Marketplace/MarketplaceHeader';

import { Feature } from '@epam/ai-dial-shared';

function Marketplace() {
  const isMarketplaceEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.Marketplace),
  );

  const router = useRouter();
  useEffect(() => {
    if (!isMarketplaceEnabled) {
      router.push('/');
    }
  }, [isMarketplaceEnabled, router]);

  if (!isMarketplaceEnabled) return <Loader />;

  return (
    <div className="flex size-full flex-col sm:pt-0">
      <MarketplaceHeader />
      <div className="relative flex size-full grow overflow-hidden">
        <MarketplaceFilterbar />

        <MarketplaceView />

        <ChatModalsManager />
      </div>
    </div>
  );
}

Marketplace.getLayout = getLayout;

export default Marketplace;

export const getServerSideProps = getCommonPageProps;
