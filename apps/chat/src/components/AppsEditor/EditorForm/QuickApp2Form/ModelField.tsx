import React, { useCallback, useMemo, useState } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getGroupMarketplaceEntityKey } from '@/src/utils/app/marketplace';
import { isEntityIdPublic } from '@/src/utils/app/publications';

import { DialAIEntityModel } from '@/src/types/models';
import { CardType } from '@/src/types/talkTo';
import { Translation } from '@/src/types/translation';

import { ApplicationSelectors } from '@/src/store/application/application.selectors';
import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.selectors';

import { PUBLIC_APP_TOOLTIP } from '@/src/constants/applications';
import { ChatI18nKeys, MarketplaceI18nKeys } from '@/src/constants/i18n';
import { MarketplaceTabs } from '@/src/constants/marketplace';
import { NA_VERSION } from '@/src/constants/publication';
import { SuggestedCard } from '@/src/constants/talkTo';

import { QuickApp2Form as QuickApp2FormType } from '@/src/components/AppsEditor/form';
import { ModelVersionSelect } from '@/src/components/Chat/ModelVersionSelect';
import { SelectModelSlider } from '@/src/components/Chat/SelectModelSlider/SelectModelSlider';
import { ItemCardView } from '@/src/components/Chat/TalkTo/ItemCardView';
import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import { SuggestionButton } from '@/src/components/Common/SuggestionButton';

import { DialEllipsisTooltip, DialLinkButton } from '@epam/ai-dial-ui-kit';

interface SliderItemProps {
  selectedModelId: string;
  groupItem: CardType;
  onSelectModel: (item: DialAIEntityModel) => void;
  onOpenMarketplaceTab: () => void;
}

const SliderItem = ({
  groupItem,
  selectedModelId,
  onSelectModel,
  onOpenMarketplaceTab,
}: SliderItemProps) => {
  const { t } = useTranslation(Translation.Chat);

  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

  const isSelected = groupItem.reference === selectedModelId;
  const isUnavailableModel = !modelsMap[groupItem.reference];

  if (groupItem === SuggestedCard) {
    return (
      <div
        className="flex size-full cursor-pointer flex-col items-center justify-center gap-3 rounded-md border border-primary hover:bg-layer-3"
        onClick={onOpenMarketplaceTab}
        key={SuggestedCard.id}
      >
        <h3 className="text-base">{t(ChatI18nKeys.CouldntFindWhatYouNeed)}</h3>
        <SuggestionButton />
      </div>
    );
  }

  return (
    <ItemCardView
      isSelected={isSelected}
      hasError={isUnavailableModel}
      isUnavailableModel={isUnavailableModel}
      key={groupItem.id}
      entity={groupItem as DialAIEntityModel}
      onClick={onSelectModel}
    />
  );
};

export const ModelField = () => {
  const { t } = useTranslation(Translation.Marketplace);

  const toolSupportingModels = useAppSelector(
    ModelsSelectors.selectToolSupportingModels,
  );
  const appDetails = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  );
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

  const isAppPublic = !!appDetails && isEntityIdPublic(appDetails);

  const [selectorOpened, setSelectorOpened] = useState(false);
  const [tab, setTab] = useState(MarketplaceTabs.MY_WORKSPACE);

  const { control, setValue } = useFormContext<QuickApp2FormType>();
  const selectedModelId = useWatch({
    control,
    name: 'model',
  });
  const selectedEntity = modelsMap[selectedModelId];

  const versions = useMemo(
    () =>
      selectedEntity
        ? toolSupportingModels.filter(
            (m) =>
              getGroupMarketplaceEntityKey(m) ===
              getGroupMarketplaceEntityKey(selectedEntity),
          )
        : [],
    [selectedEntity, toolSupportingModels],
  );

  const handleOpenSelector = useCallback(
    () => setSelectorOpened(true),
    [setSelectorOpened],
  );

  const handleCloseSelector = useCallback(
    () => setSelectorOpened(false),
    [setSelectorOpened],
  );

  const sliderItemProps = useMemo(
    () => ({
      selectedModelId,
      onSelectModel: (m: DialAIEntityModel) => {
        setValue('model', m.reference, {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        });
        setSelectorOpened(false);
      },
      onOpenMarketplaceTab: () => setTab(MarketplaceTabs.HOME),
    }),
    [selectedModelId, setValue],
  );

  return (
    <Controller
      name="model"
      control={control}
      render={({ field }) => (
        <>
          <div className="flex items-center justify-between rounded-[4px] border border-tertiary bg-layer-3 px-4 py-3">
            <div className="flex min-w-0 flex-1 grow items-center gap-3">
              <ModelIcon
                size={32}
                entityId={selectedModelId}
                entity={selectedEntity}
              />

              <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                <span
                  className={classNames(
                    'truncate text-sm font-semibold',
                    selectedEntity ? 'text-primary' : 'text-secondary',
                  )}
                >
                  <DialEllipsisTooltip
                    text={selectedEntity?.name ?? selectedModelId}
                  />
                </span>

                {selectedEntity?.version && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-secondary">
                      {t(MarketplaceI18nKeys.VersionPrefixMarketplace)}
                    </span>

                    {selectedEntity?.version && (
                      <ModelVersionSelect
                        entities={versions}
                        currentEntity={selectedEntity}
                        onSelect={({ id }) => field.onChange(id)}
                        className="truncate"
                        triggerClassName="!text-xs"
                        readonly={isAppPublic}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>

            <DialLinkButton
              className="shrink-0"
              label={t(MarketplaceI18nKeys.Change)}
              onClick={handleOpenSelector}
              disabled={isAppPublic}
              tooltipProps={
                isAppPublic
                  ? {
                      tooltip: PUBLIC_APP_TOOLTIP,
                    }
                  : undefined
              }
            />
          </div>

          {selectorOpened && (
            <SelectModelSlider<Omit<SliderItemProps, 'groupItem'>>
              onClose={handleCloseSelector}
              models={toolSupportingModels}
              currentModelId={selectedModelId}
              tab={tab}
              setTab={setTab}
              SliderItem={SliderItem}
              itemProps={sliderItemProps}
              title={t(MarketplaceI18nKeys.SelectModel)}
            />
          )}
        </>
      )}
    />
  );
};
