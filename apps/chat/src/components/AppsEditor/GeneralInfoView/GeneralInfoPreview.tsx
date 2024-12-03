import { useMemo } from 'react';

import { ApiKeys, EntityType } from '@/src/types/common';

import { ApplicationCard } from '../../Marketplace/ApplicationCard';
import { FormData } from './form';

interface GeneralInfoPreviewProps {
  data: FormData;
}

export const GeneralInfoPreview = ({ data }: GeneralInfoPreviewProps) => {
  const entity = useMemo(() => {
    return {
      ...data,
      type: EntityType.Application,
      isDefault: true,
      reference: '',
      id: `${ApiKeys.Applications}/draft`,
    };
  }, [data]);
  return (
    <div className="flex size-full max-w-[1000px] flex-col overflow-hidden p-6">
      <h2 className="mb-4">Preview</h2>
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-[700px] flex-col divide-y divide-tertiary overflow-y-auto bg-blackout bg-layer-3 p-3 md:p-5 xl:max-w-[720px]">
          <ApplicationCard
            entity={entity}
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
