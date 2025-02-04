import { ApiKeys, EntityType } from '@/src/types/common';

import { ApplicationCard } from '../../Marketplace/ApplicationCard';
import { ApplicationGeneralInfoFormData } from './form';

interface GeneralInfoPreviewProps {
  data: ApplicationGeneralInfoFormData;
}

export const getPreviewEntityData = (data: ApplicationGeneralInfoFormData) => {
  return {
    name: data.name ?? '',
    version: data.version ?? '',
    description: data.description ?? '',
    iconUrl: data.iconUrl ?? '',
    topics: data.topics ?? [],
    reference: '',
    features: undefined,
    id: `${ApiKeys.Applications}/draft`,
    completionUrl: '',
    type: EntityType.Application,
    isDefault: true,
  };
};

export const GeneralInfoPreview = ({ data }: GeneralInfoPreviewProps) => {
  return (
    <div className="flex h-full flex-col p-6">
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-[700px] flex-col divide-y divide-tertiary bg-blackout bg-layer-3 p-3 md:p-5 xl:max-w-[720px]">
          <ApplicationCard
            entity={getPreviewEntityData(data)}
            onClick={() => null}
            isPreview
            onDelete={() => null}
            onPublish={() => null}
          />
        </div>
      </div>
    </div>
  );
};
