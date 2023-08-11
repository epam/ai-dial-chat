import { Fragment, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import HomeContext from '@/pages/api/home/home.context';

import { ModelIcon } from '../Chatbar/components/ModelIcon';

import XMark from '../../public/images/icons/xmark.svg';
import { EntityMarkdownDescription } from '../Common/MarkdownDescription';
import { Tooltip, TooltipContent, TooltipTrigger } from '../Common/Tooltip';
import { AddonsDialog } from './AddonsDialog';

interface AddonsProps {
  preselectedAddonsIds: string[];
  selectedAddonsIds: string[];
  onChangeAddon: (addonId: string) => void;
  onApplyAddons: (addonsIds: string[]) => void;
}

export const Addons = ({
  preselectedAddonsIds,
  selectedAddonsIds,
  onChangeAddon,
  onApplyAddons,
}: AddonsProps) => {
  const {
    state: { addonsMap, lightMode, recentAddonsIds },
  } = useContext(HomeContext);
  const { t } = useTranslation('chat');
  const [filteredRecentAddons, setFilteredRecentAddons] = useState<string[]>(
    () => {
      return recentAddonsIds.filter((id) => !selectedAddonsIds.includes(id));
    },
  );
  const [isAddonsDialogOpen, setIsAddonsDialogOpen] = useState(false);

  useEffect(() => {
    setFilteredRecentAddons(
      recentAddonsIds.filter((id) => !selectedAddonsIds.includes(id)),
    );
  }, [selectedAddonsIds, recentAddonsIds]);

  const getAddon = (addonId: string, isSelected = false) => {
    const description = addonsMap[addonId]?.description;
    const template = (
      <button
        className={`flex items-center gap-2 px-3 py-2  ${
          isSelected ? 'bg-blue-500/20' : 'bg-gray-100 dark:bg-gray-700'
        }`}
        disabled={preselectedAddonsIds.includes(addonId)}
        onClick={() => {
          onChangeAddon(addonId);
        }}
      >
        <ModelIcon
          entity={addonsMap[addonId]}
          entityId={addonId}
          size={15}
          inverted={!addonsMap[addonId]?.iconUrl && lightMode === 'dark'}
        />
        <span>{addonsMap[addonId]?.name || addonId}</span>
        {isSelected && !preselectedAddonsIds.includes(addonId) && (
          <XMark height={12} width={12} className="text-gray-500" />
        )}
      </button>
    );

    return (
      <Fragment key={addonId}>
        {description ? (
          <Tooltip>
            <TooltipTrigger className="flex shrink-0">
              {template}
            </TooltipTrigger>
            <TooltipContent>
              <EntityMarkdownDescription>
                {description}
              </EntityMarkdownDescription>
            </TooltipContent>
          </Tooltip>
        ) : (
          template
        )}
      </Fragment>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <span>{t('Addons (max 10)')}</span>

      {selectedAddonsIds?.length > 0 && (
        <>
          <span className="text-gray-500">{t('Selected')}</span>
          <div className="flex flex-wrap gap-1">
            {selectedAddonsIds.map((addon) => getAddon(addon, true))}
          </div>
        </>
      )}
      {(!selectedAddonsIds || selectedAddonsIds.length < 11) && (
        <>
          {filteredRecentAddons?.length > 0 && (
            <>
              <span className="text-gray-500">{t('Recent')}</span>
              <div className="flex flex-wrap gap-1">
                {filteredRecentAddons.map((addon) => getAddon(addon, false))}
              </div>
            </>
          )}
          <div>
            <button
              className="mt-3 inline text-left text-blue-500"
              onClick={() => {
                setIsAddonsDialogOpen(true);
              }}
            >
              {t('See all addons...')}
            </button>
          </div>
          <AddonsDialog
            isOpen={isAddonsDialogOpen}
            selectedAddonsIds={selectedAddonsIds}
            preselectedAddonsIds={preselectedAddonsIds}
            onClose={() => {
              setIsAddonsDialogOpen(false);
            }}
            onAddonsSelected={onApplyAddons}
          />
        </>
      )}
    </div>
  );
};
