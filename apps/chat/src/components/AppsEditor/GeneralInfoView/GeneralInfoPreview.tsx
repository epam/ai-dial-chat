import { getApplicationEntityFields } from '@/src/utils/app/application';
import { fakeCallback } from '@/src/utils/app/common';

import { ApplicationCard } from '../../Marketplace/AgentsList/AgentsTiles/ApplicationCard';
import { ApplicationGeneralInfoFormData } from './form';

interface GeneralInfoPreviewProps {
  data: ApplicationGeneralInfoFormData;
}

export const GeneralInfoPreview = ({ data }: GeneralInfoPreviewProps) => {
  return (
    <div className="flex h-full flex-col p-6">
      <div className="flex flex-1 items-center justify-center">
        <div
          className="w-full max-w-[700px] xl:max-w-[720px]"
          data-qa="app-preview"
        >
          <ApplicationCard
            entity={getApplicationEntityFields(data)}
            onClick={fakeCallback}
            isPreview
            onDelete={fakeCallback}
            onPublish={fakeCallback}
          />
        </div>
      </div>
    </div>
  );
};
