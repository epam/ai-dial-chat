import { getCommonPageProps } from '@/src/utils/server/get-common-page-props';

import { AppsEditorHeader } from '@/src/components/AppsEditor/AppsEditorHeader';
import { GeneralInfoView } from '@/src/components/AppsEditor/GeneralInfoView/GeneralInfoView';

export default function AppsEditor() {
  return (
    <div className="flex size-full flex-col">
      <AppsEditorHeader />
      <div className="flex size-full">
        <GeneralInfoView />
      </div>
    </div>
  );
}

export const getServerSideProps = getCommonPageProps;
