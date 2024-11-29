import { getCommonPageProps } from '@/src/utils/server/get-common-page-props';

import { AppsEditorHeader } from '@/src/components/AppsEditor/AppsEditorHeader';
import { GeneralInfoView } from '@/src/components/AppsEditor/GeneralInfoView/GeneralInfoView';

import { getLayout } from '../../_app';

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

AppsEditor.getLayout = getLayout;

export const getServerSideProps = getCommonPageProps;
