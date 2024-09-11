import { getCommonPageProps } from '@/src/utils/server/get-common-page-props';

import MarketplaceHeader from '@/src/components/Header/MarketplaceHeader';
import MarketplaceView from '@/src/components/Marketplace/Marketplace';
import MarketplaceFilterbar from '@/src/components/Marketplace/MarketplaceFilterbar';

export default function Marketplace() {
  return (
    <div className="flex size-full flex-col sm:pt-0">
      <MarketplaceHeader />
      <div className="relative flex h-screen w-full grow overflow-hidden">
        <MarketplaceFilterbar />

        <MarketplaceView />
      </div>
    </div>
  );
}

export const getServerSideProps = getCommonPageProps;
