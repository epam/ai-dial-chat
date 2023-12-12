import { Fragment, useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { OpenAIEntityAddon } from '@/src/types/openai';
import { Translation } from '@/src/types/translation';

import { AddonsSelectors } from '@/src/store/addons/addons.reducers';
import { useAppSelector } from '@/src/store/hooks';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { ModelIcon } from '../Chatbar/components/ModelIcon';

import XMark from '../../../public/images/icons/xmark.svg';
import { EntityMarkdownDescription } from '../Common/MarkdownDescription';
import Tooltip from '../Common/Tooltip';
import { AddonsDialog } from './AddonsDialog';

interface AddonProps {
  addonId: string;
  isSelected: boolean;
  preselectedAddonsIds: string[];
  onChangeAddon: (addonId: string) => void;
}

const Addon = ({
  addonId,
  preselectedAddonsIds,
  isSelected = false,
  onChangeAddon,
}: AddonProps) => {
  const theme = useAppSelector(UISelectors.selectThemeState);
  const addonsMap = useAppSelector(AddonsSelectors.selectAddonsMap);

  const description = useMemo(
    () => addonsMap[addonId]?.description,
    [addonId, addonsMap],
  );

  const template = (
    <button
      className={classNames(
        `flex items-center gap-2 rounded px-3 py-2 text-left`,
        { 'bg-blue-500/20': isSelected },
        {
          'bg-gray-100 hover:bg-gray-400': !isSelected,
        },
      )}
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
        <Tooltip
          tooltip={
            <EntityMarkdownDescription>{description}</EntityMarkdownDescription>
          }
          triggerClassName="flex shrink-0"
          contentClassName="max-w-[220px]"
        >
          {template}
        </Tooltip>
      ) : (
        template
      )}
    </Fragment>
  );
};

interface AddonsProps {
  preselectedAddonsIds: string[];
  selectedAddonsIds: string[];
  onChangeAddon: (addonId: string) => void;
  onApplyAddons: (addonsIds: string[]) => void;
}

const filterRecentAddons = (
  recentAddonsIds: string[],
  selectedAddonsIds: string[],
  preselectedAddonsIds: string[],
  addonsMap: Partial<Record<string, OpenAIEntityAddon>>,
) => {
  return recentAddonsIds.filter(
    (id) =>
      addonsMap[id] &&
      !selectedAddonsIds.includes(id) &&
      !preselectedAddonsIds.includes(id),
  );
};

export const Addons = ({
  preselectedAddonsIds,
  selectedAddonsIds,
  onChangeAddon,
  onApplyAddons,
}: AddonsProps) => {
  const { t } = useTranslation(Translation.Chat);
  const recentAddonsIds = useAppSelector(AddonsSelectors.selectRecentAddonsIds);
  const addonsMap = useAppSelector(AddonsSelectors.selectAddonsMap);

  const [filteredRecentAddons, setFilteredRecentAddons] = useState<string[]>(
    filterRecentAddons(
      recentAddonsIds,
      selectedAddonsIds,
      preselectedAddonsIds,
      addonsMap,
    ),
  );
  const [isAddonsDialogOpen, setIsAddonsDialogOpen] = useState(false);

  useEffect(() => {
    setFilteredRecentAddons(
      filterRecentAddons(
        recentAddonsIds,
        selectedAddonsIds,
        preselectedAddonsIds,
        addonsMap,
      ),
    );
  }, [selectedAddonsIds, preselectedAddonsIds, recentAddonsIds, addonsMap]);

  return (
    <div className="flex flex-col gap-3" data-qa="addons">
      <span>{t('Addons (max 10)')}</span>

      {(selectedAddonsIds?.filter((id) => addonsMap[id]).length > 0 ||
        preselectedAddonsIds?.length > 0) && (
        <>
          <span className="text-gray-500">{t('Selected')}</span>
          <div className="flex flex-wrap gap-1" data-qa="selected-addons">
            {preselectedAddonsIds.map((addon) => (
              <Addon
                key={addon}
                addonId={addon}
                isSelected
                onChangeAddon={onChangeAddon}
                preselectedAddonsIds={preselectedAddonsIds}
              />
            ))}
            {selectedAddonsIds
              .filter(
                (id) => addonsMap[id] && !preselectedAddonsIds.includes(id),
              )
              .map((addon) => (
                <Addon
                  key={addon}
                  addonId={addon}
                  isSelected
                  onChangeAddon={onChangeAddon}
                  preselectedAddonsIds={preselectedAddonsIds}
                />
              ))}
          </div>
        </>
      )}
      {(!selectedAddonsIds ||
        selectedAddonsIds.length + preselectedAddonsIds.length < 11) && (
        <>
          {filteredRecentAddons?.length > 0 && (
            <>
              <span className="text-gray-500">{t('Recent')}</span>
              <div className="flex flex-wrap gap-1" data-qa="recent-addons">
                {filteredRecentAddons
                  .map((addon) => (
                    <Addon
                      key={addon}
                      addonId={addon}
                      isSelected={false}
                      onChangeAddon={onChangeAddon}
                      preselectedAddonsIds={preselectedAddonsIds}
                    />
                  ))
                  .filter(Boolean)}
              </div>
            </>
          )}
          <div>
            <button
              className="text-blue-500 mt-3 inline text-left"
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
