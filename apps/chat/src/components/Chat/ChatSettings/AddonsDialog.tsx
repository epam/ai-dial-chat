import { IconX } from '@tabler/icons-react';
import { FC, useCallback, useEffect, useState } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { doesOpenAIEntityContainSearchTerm } from '@/src/utils/app/search';

import { ModalState } from '@/src/types/modal';
import { DialAIEntity } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { AddonsSelectors } from '@/src/store/addons/addons.reducers';
import { useAppSelector } from '@/src/store/hooks';

import { OUTSIDE_PRESS } from '@/src/constants/modal';

import Modal from '@/src/components/Common/Modal';

import { ModelIcon } from '../../Chatbar/ModelIcon';
import CollapsibleSection from '../../Common/CollapsibleSection';
import { EntityMarkdownDescription } from '../../Common/MarkdownDescription';
import { NoResultsFound } from '../../Common/NoResultsFound';

interface AddonProps {
  addon: DialAIEntity;
  preselectedAddonsIds: string[];
  selectedAddons: DialAIEntity[];
  onSelectAddons: (addon: DialAIEntity, isSelected: boolean) => void;
}

const Addon = ({
  addon,
  preselectedAddonsIds,
  selectedAddons,
  onSelectAddons,
}: AddonProps) => {
  const isPreselected = preselectedAddonsIds.includes(addon.id);
  const isSelected = selectedAddons.map(({ id }) => id).includes(addon.id);

  return (
    <button
      className={classNames(
        'flex flex-col gap-3 rounded border p-3 text-left',
        {
          'bg-accent-primary-alpha': isPreselected,
          'hover:border-hover': !isPreselected,
        },
        {
          'border-blue-500': isSelected,
          'border-primary': !isSelected,
        },
      )}
      key={addon.id}
      disabled={isPreselected}
      onClick={() => {
        onSelectAddons(addon, isSelected);
      }}
    >
      <div className="flex items-center gap-2">
        <ModelIcon entity={addon} entityId={addon.id} size={24} />
        <span className="whitespace-pre-wrap text-left" data-qa="addon-name">
          {addon.name}
        </span>
      </div>
      {addon.description && (
        <span className="text-secondary">
          <EntityMarkdownDescription>
            {addon.description}
          </EntityMarkdownDescription>
        </span>
      )}
    </button>
  );
};

interface SelectedAddonProps {
  addon: DialAIEntity;
  preselectedAddonsIds: string[];
  selectedAddons: DialAIEntity[];
  onSelectAddons: (addon: DialAIEntity, isSelected: boolean) => void;
}

const SelectedAddon = ({
  addon,
  preselectedAddonsIds,
  onSelectAddons,
}: SelectedAddonProps) => {
  const isPreselected = preselectedAddonsIds.includes(addon.id);

  return (
    <button
      className="flex items-center gap-3 rounded bg-accent-primary-alpha px-3 py-2"
      key={addon.id}
      disabled={isPreselected}
      onClick={() => {
        onSelectAddons(addon, true);
      }}
    >
      <ModelIcon entity={addon} entityId={addon.id} size={15} />
      <span>{addon.name}</span>
      {!isPreselected && (
        <IconX size={14} className="text-secondary hover:text-accent-primary" />
      )}
    </button>
  );
};

interface Props {
  selectedAddonsIds: string[];
  preselectedAddonsIds: string[];
  isOpen: boolean;
  onAddonsSelected: (selectedAddons: string[]) => void;
  onClose: () => void;
}

export const AddonsDialog: FC<Props> = ({
  selectedAddonsIds,
  preselectedAddonsIds,
  isOpen,
  onAddonsSelected,
  onClose,
}) => {
  const { t } = useTranslation(Translation.Chat);

  const addons = useAppSelector(AddonsSelectors.selectAddons);
  const addonsMap = useAppSelector(AddonsSelectors.selectAddonsMap);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAddons, setSelectedAddons] = useState<DialAIEntity[]>(() => {
    return selectedAddonsIds
      .map((id) => addonsMap[id])
      .filter(Boolean) as DialAIEntity[];
  });
  const [displayedAddons, setDisplayedAddons] = useState(() => {
    return addons.filter((addon) =>
      doesOpenAIEntityContainSearchTerm(addon, searchTerm),
    );
  });

  const handleSearch = useCallback((searchValue: string) => {
    setSearchTerm(searchValue.trim().toLowerCase());
  }, []);

  useEffect(() => {
    setDisplayedAddons(
      addons.filter((addon) =>
        doesOpenAIEntityContainSearchTerm(addon, searchTerm),
      ),
    );
  }, [searchTerm, addons, selectedAddons]);

  useEffect(() => {
    setSearchTerm('');
    setSelectedAddons(
      (
        selectedAddonsIds
          .map((id) => addonsMap[id])
          .filter(Boolean) as DialAIEntity[]
      ).filter((addon) => !preselectedAddonsIds.includes(addon.id)),
    );
  }, [addonsMap, isOpen, preselectedAddonsIds, selectedAddonsIds]);

  const handleSelectAddon = useCallback(
    (addon: DialAIEntity, isSelected: boolean) => {
      setSelectedAddons((addons) => {
        if (isSelected) {
          return addons.filter((el) => el.id !== addon.id);
        }
        return [...addons, addon];
      });
    },
    [],
  );

  return (
    <Modal
      dataQa="addons-dialog"
      portalId="chat"
      onClose={onClose}
      overlayClassName="fixed inset-0 top-[48px]"
      state={isOpen ? ModalState.OPENED : ModalState.CLOSED}
      hideClose
      containerClassName="flex h-fit max-h-full h-[700px] w-full grow justify-between flex-col gap-4 divide-tertiary py-4 md:grow-0 xl:max-w-[720px] 2xl:max-w-[780px]"
      dismissProps={OUTSIDE_PRESS}
    >
      <div className="flex h-fit justify-between px-3 md:px-5">
        {t('Addons (max 10)')}
        <button
          onClick={onClose}
          className="text-secondary hover:text-accent-primary"
          data-qa="close-addons-dialog"
        >
          <IconX height={24} width={24} />
        </button>
      </div>

      <div className="h-fit px-3 md:px-5">
        <input
          name="titleInput"
          placeholder={t('Search for addons')}
          type="text"
          onChange={(e) => {
            handleSearch(e.target.value);
          }}
          className="m-0 w-full rounded border border-primary bg-transparent px-3 py-2 outline-none placeholder:text-secondary focus-visible:border-accent-primary"
        ></input>
      </div>
      <div
        className="flex grow flex-col gap-4 overflow-hidden px-3 text-xs md:px-5"
        data-qa="addon-search-results"
      >
        {(selectedAddons?.filter((addon) => addonsMap[addon.id]).length > 0 ||
          preselectedAddonsIds?.length > 0) && (
          <CollapsibleSection
            togglerClassName="!text-secondary !pt-0"
            name={t('Selected')}
            openByDefault
            dataQa="selected-addons"
            className="flex flex-col !pl-0 !pt-0"
          >
            <div className="flex flex-wrap gap-1">
              {preselectedAddonsIds.map((addonID) => {
                const addon = addonsMap[addonID];
                if (
                  !addon ||
                  selectedAddons.map((addon) => addon.id).includes(addonID)
                ) {
                  return null;
                }

                return (
                  <SelectedAddon
                    key={addon.id}
                    addon={addon}
                    preselectedAddonsIds={preselectedAddonsIds}
                    selectedAddons={selectedAddons}
                    onSelectAddons={handleSelectAddon}
                  />
                );
              })}
              {selectedAddons.map((addon) => (
                <SelectedAddon
                  key={addon.id}
                  addon={addon}
                  preselectedAddonsIds={preselectedAddonsIds}
                  selectedAddons={selectedAddons}
                  onSelectAddons={handleSelectAddon}
                />
              ))}
            </div>
          </CollapsibleSection>
        )}
        {displayedAddons?.length > 0 ? (
          <div className="flex shrink grow flex-col gap-3 overflow-y-auto">
            <span className="text-secondary">{t('Search results')}</span>

            <div className="grid grid-cols-2 flex-wrap gap-3 md:grid-cols-3">
              {displayedAddons.map((addon) => (
                <Addon
                  key={addon.id}
                  addon={addon}
                  preselectedAddonsIds={preselectedAddonsIds}
                  selectedAddons={selectedAddons}
                  onSelectAddons={handleSelectAddon}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex min-h-[200px] grow items-center justify-center">
            <NoResultsFound />
          </div>
        )}
      </div>
      <div className="flex items-center justify-end border-t px-3 pt-4 md:px-5">
        <button
          className="button button-primary"
          onClick={() => {
            onClose();
            onAddonsSelected(selectedAddons.map(({ id }) => id));
          }}
          disabled={selectedAddons.length + preselectedAddonsIds.length > 10}
          data-qa="apply-addons"
        >
          {t('Apply addons')}
        </button>
      </div>
    </Modal>
  );
};
