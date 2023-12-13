import {
  FloatingPortal,
  useDismiss,
  useFloating,
  useInteractions,
} from '@floating-ui/react';
import { FC, useCallback, useEffect, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { OpenAIEntity } from '@/src/types/openai';
import { Translation } from '@/src/types/translation';

import { AddonsSelectors } from '@/src/store/addons/addons.reducers';
import { useAppSelector } from '@/src/store/hooks';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { ModelIcon } from '../Chatbar/components/ModelIcon';

import XMark from '../../../public/images/icons/xmark.svg';
import { EntityMarkdownDescription } from '../Common/MarkdownDescription';
import { NoResultsFound } from '../Common/NoResultsFound';

interface AddonProps {
  addon: OpenAIEntity;
  preselectedAddonsIds: string[];
  selectedAddons: OpenAIEntity[];
  onSelectAddons: (addon: OpenAIEntity, isSelected: boolean) => void;
}

const Addon = ({
  addon,
  preselectedAddonsIds,
  selectedAddons,
  onSelectAddons,
}: AddonProps) => {
  const theme = useAppSelector(UISelectors.selectThemeState);

  const isPreselected = preselectedAddonsIds.includes(addon.id);
  const isSelected = selectedAddons.map(({ id }) => id).includes(addon.id);

  return (
    <button
      className={classNames(
        `flex flex-col gap-3 rounded border p-3 text-left`,
        {
          'bg-accent-primary': isPreselected,
          'hover:border-gray-800': !isPreselected,
        },
        {
          'border-blue-500': isSelected,
          'border-gray-400': !isSelected,
        },
      )}
      key={addon.id}
      disabled={isPreselected}
      onClick={() => {
        onSelectAddons(addon, isSelected);
      }}
    >
      <div className="flex items-center gap-2">
        <ModelIcon
          entity={addon}
          entityId={addon.id}
          size={24}
          inverted={!addon.iconUrl && theme === 'dark'}
        />
        <span className="text-left" data-qa="addon-name">
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
  addon: OpenAIEntity;
  preselectedAddonsIds: string[];
  selectedAddons: OpenAIEntity[];
  onSelectAddons: (addon: OpenAIEntity, isSelected: boolean) => void;
}

const SelectedAddon = ({
  addon,
  preselectedAddonsIds,
  onSelectAddons,
}: SelectedAddonProps) => {
  const isPreselected = preselectedAddonsIds.includes(addon.id);
  const theme = useAppSelector(UISelectors.selectThemeState);

  return (
    <button
      className="flex items-center gap-3 rounded bg-accent-primary px-3 py-2"
      key={addon.id}
      disabled={isPreselected}
      onClick={() => {
        onSelectAddons(addon, true);
      }}
    >
      <ModelIcon
        entity={addon}
        entityId={addon.id}
        size={15}
        inverted={!addon.iconUrl && theme === 'dark'}
      />
      <span>{addon.name}</span>
      {!isPreselected && (
        <XMark
          height={12}
          width={12}
          className="hover:text-blue-500 text-secondary"
        />
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
  const [selectedAddons, setSelectedAddons] = useState<OpenAIEntity[]>(() => {
    return selectedAddonsIds
      .map((id) => addonsMap[id])
      .filter(Boolean) as OpenAIEntity[];
  });
  const [displayedAddons, setDisplayedAddons] = useState(() => {
    return addons.filter((addon) =>
      (addon.name || addon.id).toLowerCase().trim().includes(searchTerm),
    );
  });

  const { refs, context } = useFloating({
    open: isOpen,
    onOpenChange: () => {
      onClose();
    },
  });
  const dismiss = useDismiss(context);
  const { getFloatingProps } = useInteractions([dismiss]);

  const handleSearch = useCallback((searchValue: string) => {
    setSearchTerm(searchValue.trim().toLowerCase());
  }, []);

  useEffect(() => {
    setDisplayedAddons(
      addons.filter((addon) =>
        (addon.name || addon.id).toLowerCase().trim().includes(searchTerm),
      ),
    );
  }, [searchTerm, addons, selectedAddons]);

  useEffect(() => {
    setSearchTerm('');
    setSelectedAddons(
      (
        selectedAddonsIds
          .map((id) => addonsMap[id])
          .filter(Boolean) as OpenAIEntity[]
      ).filter((addon) => !preselectedAddonsIds.includes(addon.id)),
    );
  }, [addonsMap, isOpen, preselectedAddonsIds, selectedAddonsIds]);

  const handleSelectAddon = useCallback(
    (addon: OpenAIEntity, isSelected: boolean) => {
      setSelectedAddons((addons) => {
        if (isSelected) {
          return addons.filter((el) => el.id !== addon.id);
        }
        return [...addons, addon];
      });
    },
    [],
  );

  // Render nothing if the dialog is not open.
  if (!isOpen) {
    return <></>;
  }

  // Render the dialog.
  return (
    <FloatingPortal id="chat">
      <div className="fixed inset-0 top-[48px] z-30 flex items-center justify-center bg-blackout p-3 md:p-5">
        <div
          className="m-auto flex h-full w-full grow flex-col gap-4 overflow-y-auto rounded bg-layer-3 py-4 text-left md:grow-0 xl:max-w-[720px] 2xl:max-w-[780px]"
          role="dialog"
          ref={refs.setFloating}
          {...getFloatingProps()}
          data-qa="addons-dialog"
        >
          <div className="flex justify-between px-3 md:px-5">
            {t('Addons (max 10)')}
            <button
              onClick={() => {
                onClose();
              }}
              className="text-secondary hover:text-accent-primary"
              data-qa="close-addons-dialog"
            >
              <XMark height={24} width={24} />
            </button>
          </div>

          <div className="px-3 md:px-5">
            <input
              name="titleInput"
              placeholder={t('Search for addons') || ''}
              type="text"
              onChange={(e) => {
                handleSearch(e.target.value);
              }}
              className="focus-visible:border-controls-accent m-0 w-full rounded border border-primary bg-transparent px-3 py-2 outline-none placeholder:text-secondary"
            ></input>
          </div>
          <div
            className="flex flex-col gap-4 px-3 text-xs md:px-5"
            data-qa="addon-search-results"
          >
            {(selectedAddons?.filter((addon) => addonsMap[addon.id]).length >
              0 ||
              preselectedAddonsIds?.length > 0) && (
              <div className="flex flex-col gap-3">
                <span className="text-secondary">{t('Selected')}</span>

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
              </div>
            )}
            {displayedAddons?.length > 0 ? (
              <div className="flex shrink grow flex-col gap-3 overflow-auto">
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

            <div className="h-[40px] shrink-0"></div>
          </div>
          <div className="relative h-0 grow">
            <div className="absolute bottom-0 flex h-[80px] w-full items-end justify-center bg-gradient-to-b from-transparent via-gray-100 to-gray-100 px-3 md:px-5">
              <button
                className="button button-primary"
                onClick={() => {
                  onClose();
                  onAddonsSelected(selectedAddons.map(({ id }) => id));
                }}
                disabled={
                  selectedAddons.length + preselectedAddonsIds.length > 10
                }
              >
                {t('Apply addons')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </FloatingPortal>
  );
};
