import { getCommonPageProps } from '@/src/utils/server/get-common-page-props';

import { AppsEditorHeader } from '@/src/components/AppsEditor/AppsEditorHeader';
import { GeneralInfo } from '@/src/components/AppsEditor/GeneralInfo';

export default function AppsEditor() {
  return (
    <div className="flex size-full flex-col">
      <AppsEditorHeader />
      <div className="flex size-full">
        <div className="w-1/2">
          <GeneralInfo />
        </div>
        <div className="w-1/2"></div>
      </div>
    </div>
  );
}

export const getServerSideProps = getCommonPageProps;
