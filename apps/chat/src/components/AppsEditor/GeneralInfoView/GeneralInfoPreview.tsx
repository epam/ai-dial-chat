import { useTranslation } from 'next-i18next';

import { ApiKeys, EntityType } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

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
    id: `${ApiKeys.Applications}/draft`,
  };
};

export const GeneralInfoPreview = ({ data }: GeneralInfoPreviewProps) => {
  const { t } = useTranslation(Translation.Chat);

  return (
    <div className="flex size-full max-w-[1000px] flex-col overflow-hidden p-6">
      <h2 className="mb-4">{t('Preview')}</h2>
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-[700px] flex-col divide-y divide-tertiary overflow-y-auto bg-blackout bg-layer-3 p-3 md:p-5 xl:max-w-[720px]">
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
