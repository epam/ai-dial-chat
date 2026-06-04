import { IconLayoutGrid, IconPlus } from '@tabler/icons-react';
import React, { MouseEvent, useCallback, useState } from 'react';

import { useSearchParams } from 'next/navigation';

import { useTranslation } from '@/src/hooks/useTranslation';

import { MarketplaceEntity } from '@/src/types/marketplace';
import { Translation } from '@/src/types/translation';

import { CommonI18nKeys } from '@/src/constants/i18n';
import { AgentsAndToolsetsModalQueryParams } from '@/src/constants/quick-apps';

import { ToggleSwitch } from '@/src/components/Common/ToggleSwitch/ToggleSwitch';
import { ToolsetLoginDialog } from '@/src/components/Marketplace/ToolsetLoginDialog';

import { AgentAndToolsetChip } from './AgentAndToolsetChip';
import { AgentAndToolsetModal } from './AgentAndToolsetModal';

import { DialLinkButton } from '@epam/ai-dial-ui-kit';

const NoAgentsAndToolsets: React.FC = () => {
  const { t } = useTranslation(Translation.Common);
  return (
    <div
      data-qa="no-agents-and-toolsets"
      className="flex flex-col items-center justify-center rounded border border-primary py-4"
    >
      <IconLayoutGrid size={60} className="mb-2 text-secondary" stroke={0.5} />
      <span>{t(CommonI18nKeys.NoAgentsAndToolsetsAdded)}</span>
    </div>
  );
};

interface AgentAndToolsetSelectorProps {
  value: string[];
  onChange: (agentAndToolset: string[]) => void;
  readonly?: boolean;
  addBtnTooltip?: string;
  allItemsMap: Record<string, MarketplaceEntity | undefined>;
  tooltip?: string;
  onItemClick?: (id: string) => void;
  onJsonSwitchClick?: () => void;
  onConfigureClick?: (item: MarketplaceEntity) => void;
}

export const AgentAndToolsetSelector: React.FC<
  AgentAndToolsetSelectorProps
> = ({
  value = [],
  readonly,
  addBtnTooltip,
  tooltip,
  allItemsMap,
  onChange,
  onItemClick,
  onJsonSwitchClick,
  onConfigureClick,
}) => {
  const { t } = useTranslation(Translation.Common);

  const searchParams = useSearchParams();

  const [isSelectModalOpen, setSelectModalOpen] = useState(
    searchParams.get(AgentsAndToolsetsModalQueryParams.Modal) === '1',
  );

  const handleOpenSelectModal = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setSelectModalOpen(true);
  };

  const handleCloseModal = useCallback(() => {
    setSelectModalOpen(false);
  }, []);

  const handleRemoveItem = useCallback(
    (idToRemove: string) => {
      onChange(value.filter((id) => id !== idToRemove));
    },
    [onChange, value],
  );

  const handleConfirmSelection = useCallback(
    (newIds: string[]) => {
      onChange(newIds);
      setSelectModalOpen(false);
    },
    [onChange],
  );

  return (
    <div className="relative grow space-y-4">
      <div className="flex flex-col">
        <div className="absolute right-0 top-[-29px] flex items-center">
          <span data-qa="add-agents-button">
            <DialLinkButton
              tooltipProps={{
                tooltip:
                  addBtnTooltip ??
                  tooltip ??
                  t(CommonI18nKeys.AddAgentsAndToolsets),
              }}
              disabled={readonly}
              onClick={handleOpenSelectModal}
              iconBefore={<IconPlus size={18} />}
              label={t(CommonI18nKeys.AddCommon)}
            />
          </span>
          {!!onJsonSwitchClick && (
            <>
              <div className="ml-1 mr-3 h-3 w-0 border-l border-primary" />
              <span data-qa="agents-and-toolsets-json-toggle">
                <ToggleSwitch
                  isOn={false}
                  handleSwitch={onJsonSwitchClick}
                  disabled={readonly}
                  switchOFFText={t(CommonI18nKeys.OFFCommon)}
                  additionalText={t(CommonI18nKeys.JSONCommon)}
                  className="flex w-fit items-center gap-2"
                  tooltip={t(
                    !readonly
                      ? CommonI18nKeys.SwitchToJsonView
                      : CommonI18nKeys.AppIsPublicCannotBeEdited,
                  )}
                />
              </span>
            </>
          )}
        </div>
        {!value.length ? (
          <NoAgentsAndToolsets />
        ) : (
          <div
            data-qa="agents-and-toolsets-list"
            className="flex flex-wrap gap-1 rounded border border-primary p-2"
          >
            {value.map((id) => (
              <AgentAndToolsetChip
                key={id}
                id={id}
                item={allItemsMap[id]}
                onRemove={readonly ? undefined : handleRemoveItem}
                readonly={readonly}
                onItemClick={onItemClick}
                onConfigure={onConfigureClick}
              />
            ))}
          </div>
        )}
      </div>
      <ToolsetLoginDialog />

      {isSelectModalOpen && !readonly && (
        <AgentAndToolsetModal
          initialSelectedIds={value}
          allItemsMap={allItemsMap}
          saveSliderStateInURL
          onClose={handleCloseModal}
          onConfirm={handleConfirmSelection}
        />
      )}
    </div>
  );
};
