import { ApiKeys, EntityType } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';

import { ApplicationCard } from '../../Marketplace/ApplicationCard';
import { ApplicationGeneralInfoFormData } from './form';

interface GeneralInfoPreviewProps {
  data: DialAIEntityModel;
}

export const getPreviewEntityData = (
  data: Partial<ApplicationGeneralInfoFormData>,
): DialAIEntityModel => {
  return {
    name: data.name ?? '',
    version: data.version,
    description: data.description,
    iconUrl: data.iconUrl,
    topics: data.topics,
    type: EntityType.Application,
    isDefault: true,
    reference: '',
    features: undefined,
    id: `${ApiKeys.Applications}/draft`,
  };
};

export const GeneralInfoPreview = ({ data }: GeneralInfoPreviewProps) => {
  return (
    <div className="flex h-full flex-col p-6">
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-[700px] flex-col divide-y divide-tertiary bg-blackout bg-layer-3 p-3 md:p-5 xl:max-w-[720px]">
          <ApplicationCard
            //update the type of data
            entity={getPreviewEntityData(
              data as unknown as ApplicationGeneralInfoFormData,
            )}
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
