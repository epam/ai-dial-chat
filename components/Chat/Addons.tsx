import { Fragment, useEffect, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { AddonsSelectors } from '@/store/addons/addons.reducers';
import { useAppSelector } from '@/store/hooks';
import { UISelectors } from '@/store/ui/ui.reducers';

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
  const theme = useAppSelector(UISelectors.selectThemeState);

  const { t } = useTranslation('chat');
  const recentAddonsIds = useAppSelector(AddonsSelectors.selectRecentAddonsIds);
  const addonsMap = useAppSelector(AddonsSelectors.selectAddonsMap);
  const [filteredRecentAddons, setFilteredRecentAddons] = useState<string[]>(
    () => {
      return recentAddonsIds.filter(
        (id) =>
          !selectedAddonsIds.includes(id) && !preselectedAddonsIds.includes(id),
      );
    },
  );
  const [isAddonsDialogOpen, setIsAddonsDialogOpen] = useState(false);

  useEffect(() => {
    setFilteredRecentAddons(
      recentAddonsIds.filter(
        (id) =>
          !selectedAddonsIds.includes(id) && !preselectedAddonsIds.includes(id),
      ),
    );
  }, [selectedAddonsIds, preselectedAddonsIds, recentAddonsIds]);

  const getAddon = (addonId: string, isSelected = false) => {
    const description = addonsMap[addonId]?.description;
    const template = (
      <button
        className={`flex items-center gap-2 rounded px-3 py-2 text-left ${
          isSelected
            ? 'bg-blue-500/20'
            : 'bg-gray-100 hover:bg-gray-400 dark:bg-gray-700 hover:dark:bg-gray-600'
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
          inverted={!addonsMap[addonId]?.iconUrl && theme === 'dark'}
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
            <TooltipContent className="max-w-[220px]">
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
    <div className="flex flex-col gap-3" data-qa="addons">
      <span>{t('Addons (max 10)')}</span>

      {(selectedAddonsIds?.length > 0 || preselectedAddonsIds?.length > 0) && (
        <>
          <span className="text-gray-500">{t('Selected')}</span>
          <div className="flex flex-wrap gap-1" data-qa="addon">
            {preselectedAddonsIds.map((addon) => getAddon(addon, true))}
            {selectedAddonsIds
              .filter((id) => !preselectedAddonsIds.includes(id))
              .map((addon) => getAddon(addon, true))}
          </div>
        </>
      )}
      {(!selectedAddonsIds ||
        selectedAddonsIds.length + preselectedAddonsIds.length < 11) && (
        <>
          {filteredRecentAddons?.length > 0 && (
            <>
              <span className="text-gray-500">{t('Recent')}</span>
              <div className="flex flex-wrap gap-1">
                {filteredRecentAddons
                  .map((addon) => getAddon(addon, false))
                  .filter(Boolean)}
              </div>
            </>
          )}
          <div>
            <button
              className="mt-3 inline text-left text-blue-500"
              onClick={() => {
                setIsAddonsDialogOpen(true);
              }}
              data-qa="see-all-addons"
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
