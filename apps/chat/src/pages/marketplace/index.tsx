import { getCommonPageProps } from '@/src/utils/server/get-common-page-props';

import MarketplaceView from '@/src/components/Marketplace/Marketplace';
import MarketplaceFilterbar from '@/src/components/Marketplace/MarketplaceFilterbar';
import MarketplaceHeader from '@/src/components/Marketplace/MarketplaceHeader';

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
