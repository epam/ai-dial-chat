import { useCallback, useState } from 'react';

import { fakeCallback } from '@/src/utils/app/common';

import { DialAIEntityModel } from '@/src/types/models';

import { ToggleSwitchLabeled } from '@/src/components/Common/ToggleSwitch/ToggleSwitchLabeled';
import { ApplicationCard } from '@/src/components/Marketplace/AgentsList/AgentsTiles/ApplicationCard';
import { ApplicationDetailsContent } from '@/src/components/Marketplace/ApplicationDetails/ApplicationContent';
import { ApplicationDetailsHeader } from '@/src/components/Marketplace/ApplicationDetails/ApplicationHeader';

interface GeneralInfoPreviewProps {
  entity: DialAIEntityModel;
}

export const GeneralInfoPreview = ({ entity }: GeneralInfoPreviewProps) => {
  const [isDetailed, setIsDetailed] = useState(true);

  const handleSwitch = useCallback(() => {
    setIsDetailed((p) => !p);
  }, []);

  return (
    <div className="flex h-full flex-col p-6">
      <div className="flex justify-end">
        <div className="w-min">
          <ToggleSwitchLabeled
            isOn={isDetailed}
            handleSwitch={handleSwitch}
            labelText="Detailed"
          />
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <div
          className="w-full max-w-[700px] xl:max-w-[720px]"
          data-qa="app-preview-general-info"
        >
          {isDetailed ? (
            <div className="flex w-full flex-col divide-y divide-tertiary rounded bg-layer-3">
              <ApplicationDetailsHeader entity={entity} isPreview />
              <ApplicationDetailsContent entity={entity} />
            </div>
          ) : (
            <ApplicationCard
              entity={entity}
              onClick={fakeCallback}
              isPreview
              onDelete={fakeCallback}
              onPublish={fakeCallback}
            />
          )}
        </div>
      </div>
    </div>
  );
};
