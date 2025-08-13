import { IconArrowsMinimize } from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

import { useTranslation } from '@/src/hooks/useTranslation';

import { fakeCallback } from '@/src/utils/app/common';

import { EntityType } from '@/src/types/common';
import { ToolsetModel } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { ToggleSwitchLabeled } from '@/src/components/Common/ToggleSwitch/ToggleSwitchLabeled';
import { Tooltip } from '@/src/components/Common/Tooltip';
import { ApplicationCard } from '@/src/components/Marketplace/AgentsList/AgentsTiles/ApplicationCard';
import { ApplicationDetailsContent } from '@/src/components/Marketplace/ApplicationDetails/ApplicationContent';
import { ApplicationDetailsHeader } from '@/src/components/Marketplace/ApplicationDetails/ApplicationHeader';
import { ToolsetEditorForm } from '@/src/components/ToolsetEditor/form';

interface ToolsetPreviewProps {
  onClosePreview?: () => void;
  currentToolset?: ToolsetModel;
}

export const ToolsetPreview = ({
  onClosePreview,
  currentToolset,
}: ToolsetPreviewProps) => {
  const { t } = useTranslation(Translation.Chat);
  const { control } = useFormContext<ToolsetEditorForm>();
  const [isDetailed, setIsDetailed] = useState(false);

  const [name, description, iconUrl, topics] = useWatch({
    control,
    name: ['name', 'description', 'iconUrl', 'topics'],
  });

  const cardEntity = useMemo(
    () => ({
      type: EntityType.Toolset,
      reference: 'some-fake-ref',
      id: 'some-fake-id',
      isDefault: false,

      name,
      description,
      iconUrl,
      topics,

      createdAt: currentToolset?.createdAt,
      updatedAt: currentToolset?.updatedAt,
      owner: currentToolset?.author,
    }),
    [
      currentToolset?.author,
      currentToolset?.createdAt,
      currentToolset?.updatedAt,
      description,
      iconUrl,
      name,
      topics,
    ],
  );

  const handleSwitch = useCallback(() => {
    setIsDetailed((p) => !p);
  }, []);

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
              <ApplicationDetailsHeader entity={cardEntity} isPreview />
              <ApplicationDetailsContent entity={cardEntity} />
            </div>
          ) : (
            <ApplicationCard
              entity={cardEntity}
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
