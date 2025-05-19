import { IconArrowsMinimize } from '@tabler/icons-react';
import { useCallback, useState } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { fakeCallback } from '@/src/utils/app/common';

import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { ToggleSwitchLabeled } from '@/src/components/Common/ToggleSwitch/ToggleSwitchLabeled';
import { ApplicationCard } from '@/src/components/Marketplace/AgentsList/AgentsTiles/ApplicationCard';
import { ApplicationDetailsContent } from '@/src/components/Marketplace/ApplicationDetails/ApplicationContent';
import { ApplicationDetailsHeader } from '@/src/components/Marketplace/ApplicationDetails/ApplicationHeader';

import Tooltip from '../../Common/Tooltip';

interface GeneralInfoPreviewProps {
  entity: DialAIEntityModel;
  onClosePreview: () => void;
}

export const GeneralInfoPreview = ({
  entity,
  onClosePreview,
}: GeneralInfoPreviewProps) => {
  const [isDetailed, setIsDetailed] = useState(true);

  const handleSwitch = useCallback(() => {
    setIsDetailed((p) => !p);
  }, []);

  const { t } = useTranslation(Translation.Chat);

  return (
    <div className="flex h-full flex-col px-5 py-4 xl:p-6">
      <div className="hidden max-w-full items-center justify-between md:flex xl:justify-end">
        <span className="mr-2 flex min-w-0 shrink grow select-none gap-2 text-primary xl:hidden">
          {t('Preview')}
        </span>
        <div className="w-min border-r border-secondary pr-3 xl:border-none xl:pr-0">
          <ToggleSwitchLabeled
            isOn={isDetailed}
            handleSwitch={handleSwitch}
            labelText="Detailed"
            isLabelOnRight
            switchOnText={t('ON')}
            switchOFFText={t('OFF')}
          />
        </div>
        <button
          className="hidden pl-3 text-secondary hover:text-accent-primary max-xl:flex"
          onClick={onClosePreview}
        >
          <Tooltip tooltip={t('Hide preview')}>
            <IconArrowsMinimize size={24} />
          </Tooltip>
        </button>
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
      <div className="flex md:hidden">
        <ToggleSwitchLabeled
          isOn={isDetailed}
          handleSwitch={handleSwitch}
          labelText="Detailed"
          isLabelOnRight
          switchOnText={t('ON')}
          switchOFFText={t('OFF')}
        />
      </div>
    </div>
  );
};
