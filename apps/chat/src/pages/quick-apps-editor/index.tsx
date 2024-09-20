import { getCommonPageProps } from '@/src/utils/server/get-common-page-props';

import { QuickApps } from '@/src/components/QuickApps/QuickApps';
import { QuickAppsHeader } from '@/src/components/QuickApps/QuickAppsHeader';

export default function QuickAppsEditor() {
  return (
    <div className="flex size-full flex-col">
      <QuickAppsHeader />

      <div className="relative flex h-screen w-full justify-center overflow-hidden">
        <QuickApps />
      </div>
    </div>
  );
}

export const getServerSideProps = getCommonPageProps;
