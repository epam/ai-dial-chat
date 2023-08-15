import {
  FloatingPortal,
  useDismiss,
  useFloating,
  useInteractions,
} from '@floating-ui/react';
import { FC, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { OpenAIEntity } from '@/types/openai';

import HomeContext from '@/pages/api/home/home.context';

import { ModelIcon } from '../Chatbar/components/ModelIcon';

import XMark from '../../public/images/icons/xmark.svg';
import { EntityMarkdownDescription } from '../Common/MarkdownDescription';
import { NoResultsFound } from '../Common/NoResultsFound';

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
  const { t } = useTranslation('chat');
  const {
    state: { addonsMap, addons, lightMode },
  } = useContext(HomeContext);
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

  const handleSearch = (searchValue: string) => {
    setSearchTerm(searchValue.trim().toLowerCase());
  };

  useEffect(() => {
    setDisplayedAddons(
      addons.filter((addon) =>
        (addon.name || addon.id).toLowerCase().trim().includes(searchTerm),
      ),
    );
  }, [searchTerm, addons, selectedAddons]);

  const getSelectedAddonTemplate = (addon: OpenAIEntity) => {
    const isPreselected = preselectedAddonsIds.includes(addon.id);
    return (
      <button
        className="flex items-center gap-3 rounded bg-blue-500/20 px-3 py-2"
        key={addon.id}
        disabled={isPreselected}
        onClick={() => {
          setSelectedAddons((addons) =>
            addons.filter((el) => el.id !== addon.id),
          );
        }}
      >
        <ModelIcon
          entity={addon}
          entityId={addon.id}
          size={15}
          inverted={!addon.iconUrl && lightMode === 'dark'}
        />
        <span>{addon.name}</span>
        {!isPreselected && (
          <XMark
            height={12}
            width={12}
            className="text-gray-500 hover:text-blue-500"
          />
        )}
      </button>
    );
  };

  const getAddonTemplate = (addon: OpenAIEntity) => {
    const isPreselected = preselectedAddonsIds.includes(addon.id);
    const isSelected = selectedAddons.map(({ id }) => id).includes(addon.id);

    return (
      <button
        className={`flex flex-col gap-3 rounded border p-3 ${
          isPreselected ? 'bg-blue-500/20' : 'hover:border-gray-200'
        } ${
          isSelected
            ? 'border-blue-500'
            : 'border-gray-400 dark:border-gray-600'
        }`}
        key={addon.id}
        disabled={isPreselected}
        onClick={() => {
          setSelectedAddons((addons) => {
            if (isSelected) {
              return addons.filter((el) => el.id !== addon.id);
            }
            return [...addons, addon];
          });
        }}
      >
        <div className="flex items-center gap-2">
          <ModelIcon
            entity={addon}
            entityId={addon.id}
            size={24}
            inverted={!addon.iconUrl && lightMode === 'dark'}
          />
          <span className="text-left">{addon.name}</span>
        </div>
        {addon.description && (
          <EntityMarkdownDescription>
            {addon.description}
          </EntityMarkdownDescription>
        )}
      </button>
    );
  };

  useEffect(() => {
    setSearchTerm('');
    setSelectedAddons(
      selectedAddonsIds
        .map((id) => addonsMap[id])
        .filter(Boolean) as OpenAIEntity[],
    );
  }, [isOpen]);

  // Render nothing if the dialog is not open.
  if (!isOpen) {
    return <></>;
  }

  // Render the dialog.
  return (
    <FloatingPortal id="theme-main">
      <div className="fixed left-0 top-0 z-50 flex h-full w-full items-center justify-center bg-gray-900/70">
        <div
          className="m-auto flex max-h-full min-h-[90%] w-[calc(100%-12px)] grow flex-col gap-4 overflow-y-auto rounded bg-gray-100 px-5 py-4 text-left dark:bg-gray-700 md:w-[790px] md:grow-0"
          role="dialog"
          ref={refs.setFloating}
          {...getFloatingProps()}
        >
          <div className="flex justify-between">
            {t('Addons (max 10)')}
            <button
              onClick={() => {
                onClose();
              }}
              className="text-gray-500 hover:text-blue-500"
            >
              <XMark height={24} width={24} />
            </button>
          </div>

          <div>
            <input
              name="titleInput"
              placeholder={t('Search for addons') || ''}
              type="text"
              onChange={(e) => {
                handleSearch(e.target.value);
              }}
              className="m-0 w-full rounded border border-gray-400 bg-transparent px-3 py-2 outline-none focus-visible:border-blue-500 dark:border-gray-600 dark:focus-visible:border-blue-500"
            ></input>
          </div>
          <div className="flex flex-col gap-4">
            {selectedAddons?.length > 0 && (
              <div className="flex flex-col gap-3">
                <span className="text-gray-500">{t('Selected')}</span>

                <div className="flex flex-wrap gap-1">
                  {selectedAddons.map((addon) =>
                    getSelectedAddonTemplate(addon),
                  )}
                </div>
              </div>
            )}
            {displayedAddons?.length > 0 ? (
              <div className="flex shrink grow flex-col gap-3 overflow-auto">
                <span className="text-gray-500">{t('Search results')}</span>

                <div className="grid grid-cols-2 flex-wrap gap-3 md:grid-cols-3">
                  {displayedAddons.map((addon) => getAddonTemplate(addon))}
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
            <div className="absolute bottom-0 flex h-[80px] w-full items-end justify-center bg-gradient-to-b from-transparent via-gray-100 to-gray-100 dark:via-gray-700 dark:to-gray-700">
              <button
                className="rounded bg-blue-500 px-3 py-2.5 text-gray-100 hover:bg-blue-700"
                onClick={() => {
                  onClose();
                  onAddonsSelected(selectedAddons.map(({ id }) => id));
                }}
                disabled={selectedAddons.length > 10}
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
