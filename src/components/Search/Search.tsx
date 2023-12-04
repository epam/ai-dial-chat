import {
  IconCheck,
  IconCircleFilled,
  IconFilter,
  IconSearch,
} from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { getByHighlightColor } from '@/src/utils/app/folders';

import { FeatureType, HighlightColor } from '@/src/types/common';
import { Feature } from '@/src/types/features';
import {
  CustomTriggerMenuRendererProps,
  DisplayMenuItemProps,
} from '@/src/types/menu';
import { SearchFilters } from '@/src/types/search';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import ContextMenu from '../Common/ContextMenu';

interface Props {
  placeholder: string;
  searchTerm: string;
  onSearch: (searchTerm: string, searchFilters: SearchFilters) => void;
  searchFilters: SearchFilters;
  featureType: FeatureType;
}

const getFilterValue = (
  filter: SearchFilters,
  value: SearchFilters,
  selected: boolean,
) => (!selected ? filter & ~value : filter | value);

const isSelected = (filter: SearchFilters, value: SearchFilters) =>
  (filter & value) === value;

export function CheckboxRenderer({
  //Renderer,
  customTriggerData: isSelected,
  onClick,
  highlightColor,
  dataQa,
  ...props
}: CustomTriggerMenuRendererProps) {
  const [checked, setChecked] = useState(isSelected);
  const handleCheck = useCallback(() => {
    setChecked((check: boolean) => !check);
    onClick && onClick(!checked);
  }, [onClick, checked]);

  return (
    <div
      className="relative flex h-[34px] w-full px-3 py-2 group-hover/file-item:flex"
      data-qa={dataQa}
    >
      <input
        id={dataQa}
        className={classNames(
          'checkbox peer h-[18px] w-[18px] cursor-pointer bg-gray-100 dark:bg-gray-700 checked:dark:border-green',
          getByHighlightColor(
            highlightColor,
            'checked:border-green hover:border-green focus:border-green checked:dark:border-green',
            'checked:border-violet hover:border-violet focus:border-violet checked:dark:border-violet',
          ),
        )}
        type="checkbox"
        checked={checked}
        onChange={handleCheck}
      />
      <IconCheck
        size={18}
        className={classNames(
          'pointer-events-none invisible absolute text-green peer-checked:visible',
          getByHighlightColor(highlightColor, 'text-green', 'text-violet'),
        )}
      />
      <label className=" cursor-pointer" htmlFor={dataQa}>
        {props.name}
      </label>
    </div>
  );
}

export default function Search({
  placeholder,
  searchTerm,
  onSearch,
  searchFilters,
  featureType,
}: Props) {
  const { t } = useTranslation(Translation.SideBar);
  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onSearch(e.target.value, searchFilters);
    },
    [searchFilters, onSearch],
  );

  const filterItems: DisplayMenuItemProps[] = useMemo(
    () =>
      [
        {
          display: enabledFeatures.has(
            featureType === FeatureType.Chat
              ? Feature.ConversationsSharing
              : Feature.PromptsSharing,
          ),
          name: 'Shared by me',
          dataQa: 'shared-by-me-filter',
          onClick: (selected: boolean) => {
            onSearch(
              searchTerm,
              getFilterValue(searchFilters, SearchFilters.SharedByMe, selected),
            );
          },
          CustomTriggerRenderer: CheckboxRenderer,
          customTriggerData: isSelected(
            searchFilters,
            SearchFilters.SharedByMe,
          ),
        },
        {
          display: enabledFeatures.has(
            featureType === FeatureType.Chat
              ? Feature.ConversationsPublishing
              : Feature.PromptsPublishing,
          ),
          name: 'Published by me',
          dataQa: 'published-by-me-filter',
          onClick: (selected: boolean) => {
            onSearch(
              searchTerm,
              getFilterValue(
                searchFilters,
                SearchFilters.PublishedByMe,
                selected,
              ),
            );
          },
          CustomTriggerRenderer: CheckboxRenderer,
          customTriggerData: isSelected(
            searchFilters,
            SearchFilters.PublishedByMe,
          ),
        },
      ].filter(({ display }) => display),
    [enabledFeatures, featureType, searchFilters, onSearch, searchTerm],
  );

  const highlightColor =
    featureType === FeatureType.Chat
      ? HighlightColor.Green
      : HighlightColor.Violet;

  return (
    <div className="relative flex items-center py-1 pl-5 pr-2">
      <IconSearch
        className="absolute left-5 text-gray-500"
        size={18}
        width={18}
        height={18}
      />
      <input
        className="w-full bg-transparent px-8 py-2 text-[14px] leading-3 outline-none placeholder:text-gray-500"
        type="text"
        placeholder={t(placeholder) || ''}
        value={searchTerm}
        onChange={handleSearchChange}
      />
      <ContextMenu
        menuItems={filterItems}
        highlightColor={highlightColor}
        triggerIconClassName="absolute right-4 cursor-pointer max-h-[18px]"
        TriggerCustomRenderer={
          <>
            <IconFilter size={18} className=" text-gray-500" />
            {searchFilters != SearchFilters.None && (
              <IconCircleFilled
                size={8}
                className={classNames(
                  'absolute right-0 top-0 bg-gray-100 p-[0.3px]  dark:bg-gray-700',
                  getByHighlightColor(
                    highlightColor,
                    'text-green',
                    'text-violet',
                  ),
                )}
              />
            )}
          </>
        }
      />
    </div>
  );
}
