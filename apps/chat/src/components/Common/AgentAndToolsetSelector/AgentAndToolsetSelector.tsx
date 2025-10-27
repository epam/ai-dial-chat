import { IconLayoutGrid, IconPlus } from '@tabler/icons-react';
import { MouseEvent, useCallback, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { MarketplaceEntity } from '@/src/types/marketplace';
import { Translation } from '@/src/types/translation';

import { Tooltip } from '@/src/components/Common/Tooltip';
import { ToolsetLoginDialog } from '@/src/components/Marketplace/ToolsetLoginDialog';

import { AgentAndToolsetChip } from './AgentAndToolsetChip';
import { AgentAndToolsetModal } from './AgentAndToolsetModal';

const NoAgentsAndToolsets: React.FC = () => {
  const { t } = useTranslation(Translation.Common);
  return (
    <div className="flex flex-col items-center justify-center rounded border border-primary py-4">
      <IconLayoutGrid size={60} className="mb-2 text-secondary" stroke={0.5} />
      <span>{t('No Agents & Toolsets added')}</span>
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
}) => {
  const { t } = useTranslation(Translation.Common);

  const [isSelectModalOpen, setSelectModalOpen] = useState(false);

  const handleOpenSelectModal = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setSelectModalOpen(true);
  };

  const handleCloseModal = useCallback(() => {
    setSelectModalOpen(false);
  }, []);

  const handleRemoveItem = (idToRemove: string) => {
    onChange(value.filter((id) => id !== idToRemove));
  };

  const handleConfirmSelection = (newIds: string[]) => {
    onChange(newIds);
    setSelectModalOpen(false);
  };

  return (
    <Tooltip tooltip={tooltip}>
      <div className="relative grow space-y-4">
        <div className="flex flex-col">
          <div className="absolute right-0 top-[-22px]">
            <Tooltip tooltip={addBtnTooltip ?? t('Add Agents and Toolsets')}>
              <button
                disabled={readonly}
                className={classNames(
                  'flex items-center text-accent-primary',
                  readonly && 'cursor-not-allowed',
                )}
                onClick={handleOpenSelectModal}
              >
                <IconPlus size={18} />
                <p className="ml-2">{t('Add')}</p>
              </button>
            </Tooltip>
          </div>
          {!value.length ? (
            <NoAgentsAndToolsets />
          ) : (
            <div className="flex flex-wrap gap-2 rounded border border-primary p-2">
              {value.map((id) => (
                <AgentAndToolsetChip
                  key={id}
                  id={id}
                  item={allItemsMap[id]}
                  onRemove={readonly ? undefined : handleRemoveItem}
                  readonly={readonly}
                  onItemClick={onItemClick}
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
            onClose={handleCloseModal}
            onConfirm={handleConfirmSelection}
          />
        )}
      </div>
    </Tooltip>
  );
};
