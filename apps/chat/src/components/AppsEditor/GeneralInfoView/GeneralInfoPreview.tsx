import { useMemo } from 'react';

import { EntityType } from '@/src/types/common';

import { ApplicationDetailsContent } from '../../Marketplace/ApplicationDetails/ApplicationContent';
import { ApplicationDetailsHeader } from '../../Marketplace/ApplicationDetails/ApplicationHeader';
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
      id: '',
    };
  }, [data]);
  return (
    <div className="flex size-full max-w-[1000px] flex-col overflow-hidden p-6">
      <h2 className="mb-4">Preview</h2>
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-[700px] flex-col divide-y divide-tertiary overflow-y-auto bg-blackout bg-layer-3 p-3 md:p-5 xl:max-w-[720px]">
          <ApplicationDetailsHeader entity={entity} isMobileView={false} />
          {entity.description && <ApplicationDetailsContent entity={entity} />}
        </div>
      </div>
    </div>
  );
};
