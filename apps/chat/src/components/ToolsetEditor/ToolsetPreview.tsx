import { useCallback, useMemo, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

import { useTranslation } from '@/src/hooks/useTranslation';

import { fakeCallback } from '@/src/utils/app/common';

import { EntityType } from '@/src/types/common';
import { PreviewMode } from '@/src/types/marketplace';
import { ToolsetModel } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { DRAFT_TOOLSET_ID } from '@/src/constants/toolsets';

import { ToggleSwitchLabeled } from '@/src/components/Common/ToggleSwitch/ToggleSwitchLabeled';
import { ApplicationCard } from '@/src/components/Marketplace/AgentsList/AgentsTiles/ApplicationCard';
import { PreviewModeButton } from '@/src/components/Marketplace/MarketplaceEditorView/PreviewModeButton';
import { ToolsetDetailsContent } from '@/src/components/Marketplace/ToolsetsDetails/ToolsetDetailsContent';
import { ToolsetDetailsHeader } from '@/src/components/Marketplace/ToolsetsDetails/ToolsetDetailsHeader';
import { ToolsetEditorForm } from '@/src/components/ToolsetEditor/form';

interface ToolsetPreviewProps {
  currentToolset?: ToolsetModel;
}

export const ToolsetPreview = ({ currentToolset }: ToolsetPreviewProps) => {
  const { t } = useTranslation(Translation.Marketplace);
  const { control } = useFormContext<ToolsetEditorForm>();
  const [isDetailed, setIsDetailed] = useState(true);

  const [
    name,
    description,
    iconUrl,
    topics,
    version,
    allowedTools,
    transport,
    authenticationType,
  ] = useWatch({
    control,
    name: [
      'name',
      'description',
      'iconUrl',
      'topics',
      'version',
      'allowedTools',
      'protocol',
      'authenticationType',
    ],
  });

  const cardEntity = useMemo(
    () =>
      ({
        type: EntityType.Toolset,
        isDefault: false,
        name,
        description,
        iconUrl,
        topics,
        version,
        allowedTools,
        transport,
        createdAt: currentToolset?.createdAt,
        updatedAt: currentToolset?.updatedAt,
        owner: currentToolset?.author,
        folderId: currentToolset?.folderId ?? 'folder-id-placeholder',
        reference: currentToolset?.reference ?? 'reference-placeholder',
        id: currentToolset?.id ?? DRAFT_TOOLSET_ID,
        authSettings: {
          ...(currentToolset?.authSettings && currentToolset.authSettings),
          authenticationType,
        },
      }) as ToolsetModel,
    [
      allowedTools,
      authenticationType,
      currentToolset?.authSettings,
      currentToolset?.author,
      currentToolset?.createdAt,
      currentToolset?.folderId,
      currentToolset?.id,
      currentToolset?.reference,
      currentToolset?.updatedAt,
      description,
      iconUrl,
      name,
      topics,
      transport,
      version,
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

        <PreviewModeButton
          mode={PreviewMode.closed}
          className="hidden pl-3 max-xl:flex"
        />
      </div>

      <div className="flex flex-1 items-center justify-center">
        <div
          className="w-full max-w-[700px] xl:max-w-[720px]"
          data-qa="app-preview-general-info"
        >
          {isDetailed ? (
            <div className="flex w-full flex-col divide-y divide-tertiary rounded bg-layer-3">
              <ToolsetDetailsHeader entity={cardEntity} isPreview />
              <ToolsetDetailsContent entity={cardEntity} />
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
